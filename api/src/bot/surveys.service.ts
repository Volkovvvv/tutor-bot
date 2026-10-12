import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { Cron, CronExpression } from '@nestjs/schedule'
import { Prisma } from '@prisma/client'
import { EventsService } from '../events/events.service'
import { PrismaService } from '../prisma/prisma.service'
import { SELF_SOURCES, selfSource } from '../telegram/source'
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
/** Знакомимся только с теми, кто прошёл онбординг недавно: давним вопрос «как узнали» уже не к месту. */
const WELCOME_UNTIL = 3 * DAY
/** Сколько ждём ответа текстом на «зачем пришли»; позже сообщение — уже не ответ. */
const WHY_OPEN = 7 * DAY
/** Ответ хранится целиком, но не бесконечный: в бота можно прислать что угодно. */
const WHY_MAX = 2000
/** Сколько людей за один проход: бот не должен засыпать вопросами всех разом. */
const BATCH = 20

type Kind = 'FORWARDED' | 'MISS_YOU' | 'SOURCE' | 'WHY'

const WHY_TAIL = 'Ответьте на это сообщение — разработчик читает каждый ответ.'
const WHY_FIRST = `Спасибо, что попробовали приложение! Какую задачу вы хотели решить, когда его открыли? ${WHY_TAIL}`
const WHY_AFTER_SOURCE = `Спасибо! И последний вопрос: какую задачу вы хотели решить, когда открыли приложение? ${WHY_TAIL}`
const THANKS = 'Спасибо! Если хочется добавить, напишите в приложении: «Написать разработчику».'

const MISS_BUTTONS: Record<string, string> = { very: 'Очень расстроюсь', little: 'Немного', no: 'Нет' }

/**
 * Вопросы, которые бот задаёт репетиторам сам, и разбор ответов на них.
 * Вопрос не повторяется: на пару «репетитор + вид + материал» есть уникальный ключ.
 */
@Injectable()
export class SurveysService {
  private readonly logger = new Logger(SurveysService.name)
  private running = false
  /** Знакомство («как узнали», «зачем пришли») включается явно: WELCOME_SURVEY=on. */
  private readonly welcome: boolean

  constructor(
    private readonly prisma: PrismaService,
    private readonly bot: BotService,
    private readonly events: EventsService,
    config: ConfigService,
  ) {
    this.welcome = config.get<string>('WELCOME_SURVEY') === 'on'
    // В конструкторе, а не в onModuleInit: к старту бота обработчик уже стоит
    this.bot.instance.on('callback_query:data', async (ctx, next) => {
      const [prefix, id, code] = ctx.callbackQuery.data.split(':')
      if (prefix !== 's' || !id || !code) return next()

      const saved = await this.answer(id, BigInt(ctx.from.id), code).catch((e: Error) => {
        this.logger.error(`Ответ на вопрос не записан: ${e.message}`)
        return null
      })
      await ctx.answerCallbackQuery()
      if (!saved) return
      // Кнопки убираем: ответ один, повторное нажатие ничего не изменит
      await ctx.editMessageReplyMarkup({ reply_markup: undefined }).catch(() => {})
      // Узнали, откуда пришёл, — сразу спрашиваем зачем, пока человек в чате
      const why =
        saved.kind === 'SOURCE' &&
        (await this.create(saved.tutorId, 'WHY', '').catch((e: Error) => {
          this.logger.error(`Вопрос «зачем пришли» не создан: ${e.message}`)
          return null
        }))
      await ctx.reply(why ? WHY_AFTER_SOURCE : THANKS)
    })

    this.bot.onText((tgId, text) =>
      this.answerWhy(tgId, text).catch((e: Error) => {
        this.logger.error(`Ответ «зачем пришли» не записан: ${e.message}`)
        return null
      }),
    )
  }

  /** Записывает ответ; null — вопроса нет, он чужой или уже отвечен. */
  async answer(surveyId: string, tgId: bigint, code: string): Promise<{ kind: string; tutorId: string } | null> {
    const survey = await this.prisma.survey.findUnique({
      where: { id: surveyId },
      select: { id: true, kind: true, ref: true, answer: true, tutorId: true, tutor: { select: { user: { select: { tgId: true } } } } },
    })
    if (!survey || survey.answer !== null || survey.tutor.user.tgId !== tgId) return null

    if (survey.kind === 'FORWARDED' && (code === 'y' || code === 'n')) {
      await this.events.track(survey.tutorId, 'material_forwarded', { lessonId: survey.ref, yes: code === 'y' })
    } else if (survey.kind === 'MISS_YOU' && code in MISS_BUTTONS) {
      await this.events.track(survey.tutorId, 'retention_answer', { answer: code })
    } else if (survey.kind === 'SOURCE' && selfSource(code)) {
      // Метка из ссылки точнее ответа по памяти: её не перезаписываем
      await this.prisma.user.updateMany({ where: { tgId, source: null }, data: { source: selfSource(code) } })
    } else {
      return null
    }
    // Условие answer: null — на случай двух нажатий подряд
    const { count } = await this.prisma.survey.updateMany({ where: { id: survey.id, answer: null }, data: { answer: code } })
    return count > 0 ? { kind: survey.kind, tutorId: survey.tutorId } : null
  }

  /**
   * Текст, присланный боту, — ответ на «зачем пришли», если такой вопрос открыт.
   * Возвращает реплику бота; null — вопроса нет, сообщение не наше.
   */
  async answerWhy(tgId: bigint, text: string, now = new Date()): Promise<string | null> {
    const survey = await this.prisma.survey.findFirst({
      where: {
        kind: 'WHY',
        answer: null,
        askedAt: { gt: new Date(now.getTime() - WHY_OPEN) },
        tutor: { user: { tgId } },
      },
      select: { id: true, tutor: { select: { user: { select: { firstName: true, lastName: true, username: true } } } } },
    })
    if (!survey) return null

    const answer = text.slice(0, WHY_MAX)
    const { count } = await this.prisma.survey.updateMany({ where: { id: survey.id, answer: null }, data: { answer } })
    if (count === 0) return null

    const { firstName, lastName, username } = survey.tutor.user
    const name = [firstName, lastName].filter(Boolean).join(' ')
    // Сбой отправки не мешает: текст уже в базе
    await this.bot.notifyAdmin(`🧭 ${name}${username ? ` (@${username})` : ''} · зачем пришёл\n\n${answer}`)
    return THANKS
  }

  @Cron(CronExpression.EVERY_HOUR)
  async askDue(now = new Date()): Promise<void> {
    // Без бота спрашивать некому, а запись «спросили» осталась бы навсегда
    if (this.running || !this.bot.canSend) return
    this.running = true
    try {
      if (this.welcome) await this.askWelcome(now)
      await this.askForwarded(now)
      await this.askMissYou(now)
    } catch (e) {
      this.logger.error(`Сбой вопросов репетиторам: ${(e as Error).message}`)
    } finally {
      this.running = false
    }
  }

  /**
   * Знакомство после онбординга: «как узнали» кнопками и «зачем пришли» текстом.
   * Пришедших по ссылке с меткой про источник не спрашиваем — он уже известен.
   */
  private async askWelcome(now: Date): Promise<void> {
    const tutors = await this.prisma.tutor.findMany({
      where: {
        onboardedAt: { gte: new Date(now.getTime() - WELCOME_UNTIL), lte: now },
        bannedAt: null,
        surveys: { none: { kind: { in: ['SOURCE', 'WHY'] } } },
      },
      select: { id: true, user: { select: { tgId: true, source: true } } },
      take: BATCH,
    })

    for (const tutor of tutors) {
      const knowsSource = tutor.user.source !== null
      const survey = await this.create(tutor.id, knowsSource ? 'WHY' : 'SOURCE', '')
      if (!survey) continue
      if (knowsSource) {
        await this.bot.sendMessage(tutor.user.tgId, WHY_FIRST)
        continue
      }
      const buttons: InlineButton[] = Object.entries(SELF_SOURCES).map(([code, text]) => ({
        text,
        data: `s:${survey}:${code}`,
      }))
      await this.bot.sendMessage(
        tutor.user.tgId,
        'Спасибо, что попробовали приложение! Подскажите, как вы о нём узнали?',
        buttons,
        2,
      )
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
