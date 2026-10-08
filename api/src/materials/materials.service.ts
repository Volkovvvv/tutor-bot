import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { JwtService } from '@nestjs/jwt'
import type { Prisma } from '@prisma/client'
import { BotService } from '../bot/bot.service'
import { editShare } from '../events/material-edit'
import { EventsService } from '../events/events.service'
import { subjectDative } from '../invites/invite-message'
import { PrismaService } from '../prisma/prisma.service'
import { AiService } from './ai.service'
import {
  applyDoubts,
  applyTheoryFindings,
  buildCompareMessages,
  buildSolveMessages,
  buildTheoryCheckMessages,
  carryDoubts,
  type CheckItem,
  checkItems,
  codeNotes,
  isCheckedSubject,
  mergeNotes,
  parseDoubts,
  parseSolved,
  parseTheoryFindings,
  type TheoryFinding,
} from './answer-check'
import type { GenerateMaterialDto } from './dto/generate-material.dto'
import {
  coerceContent,
  DEFAULT_HOMEWORK_COUNT,
  levelLabel,
  type MaterialContent,
  materialsLimit,
  templateContent,
} from './material-content'
import { renderMaterialPdf } from './material-pdf'
import { canonicalSubject } from './subjects'

// В журнал событий предмет идёт только из этого списка: введённый руками
// может оказаться чем угодно, в том числе именем ученика.
const TRACKED_SUBJECTS = new Set([
  'Математика',
  'Русский язык',
  'Английский',
  'Физика',
  'Химия',
  'Биология',
  'Информатика',
])

function trackedSubject(subject: string): string {
  const name = canonicalSubject(subject)
  return TRACKED_SUBJECTS.has(name) ? name : 'другое'
}

const MATERIAL_SELECT = {
  lessonId: true,
  subject: true,
  topic: true,
  content: true,
  model: true,
  createdAt: true,
} satisfies Prisma.LessonMaterialSelect

type MaterialRow = Prisma.LessonMaterialGetPayload<{ select: typeof MATERIAL_SELECT }>

export interface MaterialView extends MaterialContent {
  lessonId: string
  subject: string
  topic: string
  /** Собрано шаблоном, а не ИИ: AI_API_KEY не задан. */
  isTemplate: boolean
  createdAt: Date
}

// Проверка ответов идёт в фоне и при перезапуске сервера теряется:
// если она не закончилась за это время, уже не закончится.
const CHECK_TIMEOUT_MS = 4 * 60_000

function toView(row: MaterialRow): MaterialView {
  // В базе лежит то, что прошло coerceContent при генерации; заглушка —
  // на случай строки, записанной в обход сервиса.
  const content = coerceContent(row.content) ?? templateContent(row.topic)
  const lost = content.check === 'pending' && Date.now() - row.createdAt.getTime() > CHECK_TIMEOUT_MS
  return {
    lessonId: row.lessonId,
    subject: row.subject,
    topic: row.topic,
    ...content,
    check: lost ? 'failed' : content.check,
    isTemplate: row.model === 'template',
    createdAt: row.createdAt,
  }
}

function formatDate(d: Date, timeZone: string): string {
  return new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long', year: 'numeric', timeZone })
    .format(d)
    .replace(/\s*г\.$/, '')
}

// Ссылку на PDF открывает не приложение, а Telegram или браузер —
// заголовок Authorization они не пришлют, поэтому доступ даёт токен
// в самой ссылке. Живёт недолго: ссылка остаётся в истории загрузок.
const PDF_LINK_TTL = '5m'

/** Токен ссылки на PDF. Без sub — как токен входа он не пройдёт. */
interface PdfLinkPayload {
  typ: 'material-pdf'
  lid: string
  tid: string
  /** Версия для репетитора, с ответами. */
  ans: boolean
}

export interface MaterialPdf {
  pdf: Buffer
  filename: string
}

// Имя файла ограничено 255 байтами, а кириллица — по два байта на букву:
// тема в 200 символов в лимит не влезает.
const FILENAME_TOPIC_MAX = 60

function pdfFilename(topic: string, studentName: string, withAnswers: boolean): string {
  const short =
    topic.length > FILENAME_TOPIC_MAX ? `${topic.slice(0, FILENAME_TOPIC_MAX).trimEnd()}…` : topic
  return `${short} — ${studentName}${withAnswers ? ' (с ответами)' : ''}.pdf`.replace(/[\\/:*?"<>|]/g, ' ')
}

@Injectable()
export class MaterialsService {
  private readonly logger = new Logger(MaterialsService.name)
  /** Сколько материалов ИИ соберёт одному репетитору; null — без лимита. */
  private readonly limit: number | null

  constructor(
    private readonly prisma: PrismaService,
    private readonly ai: AiService,
    private readonly bot: BotService,
    private readonly jwt: JwtService,
    private readonly events: EventsService,
    config: ConfigService,
  ) {
    this.limit = materialsLimit(config.get('AI_MATERIALS_LIMIT'))
  }

  async list(tutorId: string, lessonId?: string): Promise<MaterialView[]> {
    const rows = await this.prisma.lessonMaterial.findMany({
      where: { tutorId, ...(lessonId ? { lessonId } : {}) },
      select: MATERIAL_SELECT,
      orderBy: { createdAt: 'desc' },
    })
    return rows.map(toView)
  }

  /** Собрать материалы заново; прежние для этого урока заменяются. */
  async generate(tutorId: string, lessonId: string, dto: GenerateMaterialDto): Promise<MaterialView> {
    const startedAt = Date.now()
    const lesson = await this.prisma.lesson.findFirst({
      where: { id: lessonId, tutorId },
      select: {
        // Был ли материал: повторная сборка — сигнал, что прежний не устроил
        material: { select: { lessonId: true } },
        student: { select: { grade: true } },
        tutor: { select: { country: true, materialsGenerated: true } },
      },
    })
    if (!lesson) throw new NotFoundException('Занятие не найдено')
    if (this.limit !== null && lesson.tutor.materialsGenerated >= this.limit) {
      await this.events.track(tutorId, 'limit_hit', { used: lesson.tutor.materialsGenerated })
      throw new ForbiddenException(
        `Пробный лимит исчерпан: ИИ собрал ${this.limit} материалов. Готовые материалы остаются — их можно править и скачивать`,
      )
    }

    const subject = dto.subject.trim()
    const topic = dto.topic.trim()
    const generated = await this.ai.generate({
      subject,
      topic,
      grade: lesson.student.grade,
      country: lesson.tutor.country,
      homeworkCount: dto.homeworkCount ?? DEFAULT_HOMEWORK_COUNT,
      wishes: dto.wishes?.trim() || null,
    })
    const { model } = generated
    const toCheck = model !== 'template' && isCheckedSubject(subject)
    const content: MaterialContent = { ...generated.content, check: toCheck ? 'pending' : null }
    // Заглушка без ключа ИИ в лимит не идёт
    if (model !== 'template') {
      await this.prisma.tutor.update({ where: { id: tutorId }, data: { materialsGenerated: { increment: 1 } } })
    }

    const data = {
      subject,
      topic,
      content: content as unknown as Prisma.InputJsonValue,
      model,
    }
    const row = await this.prisma.lessonMaterial.upsert({
      where: { lessonId },
      create: { lessonId, tutorId, ...data },
      update: { ...data, createdAt: new Date() },
      select: MATERIAL_SELECT,
    })
    const regenerated = lesson.material !== null
    await this.events.track(tutorId, 'material_generated', {
      lessonId,
      subject: trackedSubject(subject),
      ...(lesson.student.grade ? { grade: lesson.student.grade } : {}),
      count: content.homework.length,
      model,
      ms: Date.now() - startedAt,
      regenerated,
    })
    if (regenerated) await this.events.track(tutorId, 'material_regenerated', { lessonId })

    // В фоне: репетитор не ждёт проверку, пометки появятся чуть позже
    if (toCheck) {
      void this.checkMaterial(tutorId, lessonId, row.createdAt, subject, lesson.student.grade, topic, content)
    }
    return toView(row)
  }

  /**
   * Проверяет ключ ответов и теорию и помечает то, что вызвало сомнение.
   * Ошибок наружу не бросает: её некому ловить, итог пишется в материал.
   * Обе проверки идут одновременно; если не удалась одна, пометки другой всё равно сохраняются.
   */
  private async checkMaterial(
    tutorId: string,
    lessonId: string,
    createdAt: Date,
    subject: string,
    grade: number | null,
    topic: string,
    content: MaterialContent,
  ): Promise<void> {
    const items = checkItems(content)
    const [notes, findings] = await Promise.all([
      this.runAnswerCheck(subject, grade, items, topic),
      this.runTheoryCheck(subject, grade, topic, content),
    ])

    try {
      // Репетитор мог поправить текст, пока шла проверка, — берём то, что в базе сейчас.
      // createdAt в условии: материал, собранный заново, проверяет уже своя проверка.
      const row = await this.prisma.lessonMaterial.findFirst({
        where: { lessonId, createdAt },
        select: { content: true },
      })
      const current = row ? coerceContent(row.content) : null
      if (!current) return
      let next: MaterialContent = current
      if (notes) next = applyDoubts(next, items, notes)
      if (findings) next = applyTheoryFindings(next, findings)
      next = { ...next, check: notes || findings ? 'done' : 'failed' }
      await this.prisma.lessonMaterial.updateMany({
        where: { lessonId, createdAt },
        data: { content: next as unknown as Prisma.InputJsonValue },
      })
      await this.events.track(tutorId, 'material_checked', {
        lessonId,
        ok: next.check === 'done',
        answerDoubts: notes?.filter(Boolean).length ?? 0,
        theoryDoubts: findings?.length ?? 0,
      })
    } catch (e) {
      this.logger.error(`Итог проверки материала не записан: ${(e as Error).message}`)
    }
  }

  /** Решает задания заново, не видя ключа, и сверяет; null — проверка не удалась. */
  private async runAnswerCheck(
    subject: string,
    grade: number | null,
    items: CheckItem[],
    topic: string,
  ): Promise<(string | null)[] | null> {
    // Что сверилось подстановкой, модели не отдаём: код в счёте не ошибается и ничего не стоит
    const byCode = codeNotes(subject, items)
    const rest = items.filter((_, i) => byCode[i] === undefined)
    const decided = items.length - rest.length
    if (rest.length === 0) return mergeNotes(byCode, [])

    try {
      const solvedRaw = await this.ai.ask(buildSolveMessages(subject, grade, rest, topic))
      const own = solvedRaw ? parseSolved(solvedRaw, rest.length) : null
      const doubtsRaw = own ? await this.ai.ask(buildCompareMessages(rest, own)) : null
      const notes = doubtsRaw ? parseDoubts(doubtsRaw, rest.length) : null
      if (!notes) this.logger.warn(`Проверка ответов не разобрана: ${(doubtsRaw ?? solvedRaw)?.slice(0, 300)}`)
      return notes || decided ? mergeNotes(byCode, notes) : null
    } catch (e) {
      this.logger.warn(`Проверка ответов не удалась: ${(e as Error).message}`)
      return decided ? mergeNotes(byCode, null) : null
    }
  }

  /** Ищет в теории ошибки, из-за которых ученик узнает неверное; null — проверка не удалась. */
  private async runTheoryCheck(
    subject: string,
    grade: number | null,
    topic: string,
    content: MaterialContent,
  ): Promise<TheoryFinding[] | null> {
    try {
      const raw = await this.ai.askChecker(buildTheoryCheckMessages(subject, grade, topic, content))
      const findings = raw ? parseTheoryFindings(raw) : null
      if (!findings) this.logger.warn(`Проверка теории не разобрана: ${raw?.slice(0, 300)}`)
      return findings
    } catch (e) {
      this.logger.warn(`Проверка теории не удалась: ${(e as Error).message}`)
      return null
    }
  }

  /** Правки репетитора: текст заменяется целиком, тема и модель остаются. */
  async update(tutorId: string, lessonId: string, raw: Record<string, unknown>): Promise<MaterialView> {
    const edited = coerceContent(raw)
    if (!edited) {
      throw new BadRequestException('В материале должны остаться теория, пример и хотя бы одно задание')
    }
    const stored = await this.prisma.lessonMaterial.findFirst({
      where: { lessonId, tutorId },
      select: { content: true },
    })
    const prev = stored ? coerceContent(stored.content) : null
    if (!prev) throw new NotFoundException('Материалы не найдены')
    const content = carryDoubts(prev, edited)
    const share = editShare(prev, edited)
    // updateMany, а не update: tutorId в условии не даёт править чужой материал
    const { count } = await this.prisma.lessonMaterial.updateMany({
      where: { lessonId, tutorId },
      data: { content: content as unknown as Prisma.InputJsonValue },
    })
    if (count === 0) throw new NotFoundException('Материалы не найдены')

    if (share > 0) await this.events.track(tutorId, 'material_edited', { lessonId, share })

    const row = await this.prisma.lessonMaterial.findUniqueOrThrow({
      where: { lessonId },
      select: MATERIAL_SELECT,
    })
    return toView(row)
  }

  async remove(tutorId: string, lessonId: string): Promise<{ deleted: true }> {
    const { count } = await this.prisma.lessonMaterial.deleteMany({ where: { lessonId, tutorId } })
    if (count > 0) await this.events.track(tutorId, 'material_deleted', { lessonId })
    return { deleted: true }
  }

  /** Одноразовая по смыслу ссылка: токен для GET /materials/pdf. */
  async pdfLink(
    tutorId: string,
    lessonId: string,
    withAnswers: boolean,
  ): Promise<{ token: string; filename: string }> {
    const row = await this.prisma.lessonMaterial.findFirst({
      where: { lessonId, tutorId },
      select: { topic: true, lesson: { select: { student: { select: { name: true } } } } },
    })
    if (!row) throw new NotFoundException('Материалы не найдены')

    await this.events.track(tutorId, 'pdf_downloaded', { lessonId, answers: withAnswers })
    const payload: PdfLinkPayload = { typ: 'material-pdf', lid: lessonId, tid: tutorId, ans: withAnswers }
    const token = await this.jwt.signAsync(payload, { expiresIn: PDF_LINK_TTL })
    return { token, filename: pdfFilename(row.topic, row.lesson.student.name, withAnswers) }
  }

  async pdfByToken(token: string): Promise<MaterialPdf> {
    let payload: PdfLinkPayload
    try {
      payload = await this.jwt.verifyAsync<PdfLinkPayload>(token)
    } catch {
      throw new UnauthorizedException('Ссылка устарела. Откройте PDF из приложения ещё раз')
    }
    if (payload.typ !== 'material-pdf' || typeof payload.lid !== 'string' || typeof payload.tid !== 'string') {
      throw new UnauthorizedException('Недействительная ссылка')
    }
    const { pdf, filename } = await this.buildPdf(payload.tid, payload.lid, payload.ans === true)
    return { pdf, filename }
  }

  /**
   * PDF уходит репетитору в чат с ботом, а не ученику: так репетитор
   * видит файл перед пересылкой, и это работает, даже если ученик
   * к боту не подключён. Версия без ответов — для пересылки ученику,
   * с ответами — для самого репетитора.
   */
  async sendToTutor(tutorId: string, lessonId: string, withAnswers = false): Promise<{ sent: true }> {
    const { pdf, filename, topic, studentName, tgId } = await this.buildPdf(tutorId, lessonId, withAnswers)
    const result = await this.bot.sendDocument(
      tgId,
      pdf,
      filename,
      withAnswers
        ? `«${topic}» для ${studentName}, с ответами. Ученику не пересылайте.`
        : `«${topic}» для ${studentName}. Перешлите файл ученику.`,
    )

    if (!result.ok) {
      if (result.error === 'BOT_MODE=off') {
        throw new ServiceUnavailableException('Бот выключен (BOT_MODE=off) — PDF не отправлен')
      }
      throw new ServiceUnavailableException(
        result.blocked
          ? 'Бот не может вам написать: откройте чат с ботом и нажмите «Начать»'
          : 'Не удалось отправить PDF. Попробуйте ещё раз',
      )
    }
    await this.events.track(tutorId, 'pdf_sent', { lessonId, answers: withAnswers })
    return { sent: true }
  }

  private async buildPdf(
    tutorId: string,
    lessonId: string,
    withAnswers: boolean,
  ): Promise<MaterialPdf & { topic: string; studentName: string; tgId: bigint }> {
    const row = await this.prisma.lessonMaterial.findFirst({
      where: { lessonId, tutorId },
      select: {
        ...MATERIAL_SELECT,
        lesson: { select: { startsAt: true, student: { select: { name: true, grade: true } } } },
        tutor: {
          select: {
            displayName: true,
            user: { select: { tgId: true, firstName: true, lastName: true, timezone: true } },
          },
        },
      },
    })
    if (!row) throw new NotFoundException('Материалы не найдены')

    const { tutor, lesson } = row
    const tutorName =
      tutor.displayName || [tutor.user.firstName, tutor.user.lastName].filter(Boolean).join(' ')
    const dative = subjectDative(row.subject)

    const pdf = await renderMaterialPdf({
      subject: row.subject,
      topic: row.topic,
      studentName: lesson.student.name,
      level: levelLabel(lesson.student.grade),
      date: formatDate(lesson.startsAt, tutor.user.timezone),
      tutorLine: dative ? `${tutorName} · репетитор по ${dative}` : tutorName,
      content: toView(row),
      withAnswers,
    })

    return {
      pdf,
      filename: pdfFilename(row.topic, lesson.student.name, withAnswers),
      topic: row.topic,
      studentName: lesson.student.name,
      tgId: tutor.user.tgId,
    }
  }
}
