import { Injectable, Logger } from '@nestjs/common'
import { Cron, CronExpression } from '@nestjs/schedule'
import { Prisma } from '@prisma/client'
import { EventsService } from '../events/events.service'
import { PrismaService } from '../prisma/prisma.service'
import { BotService, type InlineButton } from './bot.service'

const HOUR = 3_600_000
const DAY = 24 * HOUR

/** Через сколько после отправки материала без ответов спрашиваем, дошёл ли он до ученика. */
const FORWARD_AFTER = 20 * HOUR
/** Позже этого вопрос уже не про тот материал. */
const FORWARD_UNTIL = 3 * DAY
/** Репетитору не пишем про пересылку чаще раза в сутки, сколько бы материалов он ни отправил. */
const FORWARD_EVERY = DAY
/** Когда спрашиваем, расстроится ли репетитор, если генератор пропадёт. */
const MISS_AFTER = 7 * DAY
/** Сколько людей за один проход: бот не должен засыпать вопросами всех разом. */
const BATCH = 20

type Kind = 'FORWARDED' | 'MISS_YOU'

const MISS_BUTTONS: Record<string, string> = { very: 'Очень расстроюсь', little: 'Немного', no: 'Нет' }

/**
 * Вопросы, которые бот задаёт репетиторам сам, и разбор ответов на них.
 * Вопрос не повторяется: на пару «репетитор + вид + материал» есть уникальный ключ.
 */
@Injectable()
export class SurveysService {
  private readonly logger = new Logger(SurveysService.name)
  private running = false

  constructor(
    private readonly prisma: PrismaService,
    private readonly bot: BotService,
    private readonly events: EventsService,
  ) {
    // В конструкторе, а не в onModuleInit: к старту бота обработчик уже стоит
    this.bot.instance.on('callback_query:data', async (ctx, next) => {
      const [prefix, id, code] = ctx.callbackQuery.data.split(':')
      if (prefix !== 's' || !id || !code) return next()

      const saved = await this.answer(id, BigInt(ctx.from.id), code).catch((e: Error) => {
        this.logger.error(`Ответ на вопрос не записан: ${e.message}`)
        return false
      })
      await ctx.answerCallbackQuery()
      if (!saved) return
      // Кнопки убираем: ответ один, повторное нажатие ничего не изменит
      await ctx.editMessageReplyMarkup({ reply_markup: undefined }).catch(() => {})
      await ctx.reply('Спасибо! Если хочется добавить, напишите в приложении: «Написать разработчику».')
    })
  }

  /** Записывает ответ; false — вопроса нет, он чужой или уже отвечен. */
  async answer(surveyId: string, tgId: bigint, code: string): Promise<boolean> {
    const survey = await this.prisma.survey.findUnique({
      where: { id: surveyId },
      select: { id: true, kind: true, ref: true, answer: true, tutorId: true, tutor: { select: { user: { select: { tgId: true } } } } },
    })
    if (!survey || survey.answer !== null || survey.tutor.user.tgId !== tgId) return false

    if (survey.kind === 'FORWARDED' && (code === 'y' || code === 'n')) {
      await this.events.track(survey.tutorId, 'material_forwarded', { lessonId: survey.ref, yes: code === 'y' })
    } else if (survey.kind === 'MISS_YOU' && code in MISS_BUTTONS) {
      await this.events.track(survey.tutorId, 'retention_answer', { answer: code })
    } else {
      return false
    }
    // Условие answer: null — на случай двух нажатий подряд
    const { count } = await this.prisma.survey.updateMany({ where: { id: survey.id, answer: null }, data: { answer: code } })
    return count > 0
  }

  @Cron(CronExpression.EVERY_HOUR)
  async askDue(now = new Date()): Promise<void> {
    // Без бота спрашивать некому, а запись «спросили» осталась бы навсегда
    if (this.running || !this.bot.canSend) return
    this.running = true
    try {
      await this.askForwarded(now)
      await this.askMissYou(now)
    } catch (e) {
      this.logger.error(`Сбой вопросов репетиторам: ${(e as Error).message}`)
    } finally {
      this.running = false
    }
  }

  /** «Вы отправили материал ученику?» — на следующий день после отправки без ответов. */
  private async askForwarded(now: Date): Promise<void> {
    const sent = await this.prisma.event.findMany({
      where: {
        name: 'pdf_sent',
        props: { path: ['answers'], equals: false },
        createdAt: { gte: new Date(now.getTime() - FORWARD_UNTIL), lte: new Date(now.getTime() - FORWARD_AFTER) },
      },
      select: { tutorId: true, props: true },
      orderBy: { createdAt: 'desc' },
    })

    // По одному последнему материалу на репетитора
    const latest = new Map<string, string>()
    for (const e of sent) {
      const lessonId = (e.props as Record<string, unknown>)?.lessonId
      if (typeof lessonId === 'string' && !latest.has(e.tutorId)) latest.set(e.tutorId, lessonId)
    }

    let asked = 0
    for (const [tutorId, lessonId] of latest) {
      if (asked >= BATCH) break
      const recent = await this.prisma.survey.findFirst({
        where: { tutorId, kind: 'FORWARDED', askedAt: { gt: new Date(now.getTime() - FORWARD_EVERY) } },
        select: { id: true },
      })
      if (recent) continue

      const material = await this.prisma.lessonMaterial.findUnique({
        where: { lessonId },
        select: { topic: true, tutor: { select: { user: { select: { tgId: true } } } } },
      })
      if (!material) continue

      const survey = await this.create(tutorId, 'FORWARDED', lessonId)
      if (!survey) continue
      asked += 1
      await this.bot.sendMessage(material.tutor.user.tgId, `Вы отправили ученику материал «${material.topic}»?`, [
        { text: 'Да', data: `s:${survey}:y` },
        { text: 'Нет', data: `s:${survey}:n` },
      ])
    }
  }

  /** «Расстроитесь, если генератор пропадёт?» — через неделю после регистрации, если пользовался. */
  private async askMissYou(now: Date): Promise<void> {
    const tutors = await this.prisma.tutor.findMany({
      where: {
        createdAt: { lte: new Date(now.getTime() - MISS_AFTER) },
        events: { some: { name: 'material_generated' } },
        surveys: { none: { kind: 'MISS_YOU' } },
      },
      select: { id: true, user: { select: { tgId: true } } },
      take: BATCH,
    })

    for (const tutor of tutors) {
      const survey = await this.create(tutor.id, 'MISS_YOU', '')
      if (!survey) continue
      const buttons: InlineButton[] = Object.entries(MISS_BUTTONS).map(([code, text]) => ({
        text,
        data: `s:${survey}:${code}`,
      }))
      await this.bot.sendMessage(
        tutor.user.tgId,
        'Один вопрос: насколько вы расстроитесь, если генератор материалов пропадёт?',
        buttons,
      )
    }
  }

  /** Id нового вопроса; null — такой уже задавали. */
  private async create(tutorId: string, kind: Kind, ref: string): Promise<string | null> {
    try {
      const row = await this.prisma.survey.create({ data: { tutorId, kind, ref }, select: { id: true } })
      return row.id
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') return null
      throw e
    }
  }
}
