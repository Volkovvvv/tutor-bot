import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import {
  buildMessages,
  type MaterialContent,
  parseContent,
  type PromptInput,
  type ReasoningEffort,
  reasoningEffort,
  templateContent,
} from './material-content'

export interface Generated {
  content: MaterialContent
  /** Модель, собравшая материалы; "template" — заглушка без ключа. */
  model: string
}

// 10 заданий с ответами сильная модель пишет около минуты, в час пик дольше.
// Обрыв по таймауту хуже ожидания: репетитор видит ошибку, а запрос оплачен.
const TIMEOUT_MS = 150_000
// Модель иногда возвращает текст вместо JSON — одна повторная попытка
// обычно лечит это, больше только затягивает ожидание.
const ATTEMPTS = 2
// 10 заданий с ответами — около 3000 токенов, остальное — рассуждения:
// Claude тратит на них 5–8 тысяч и в меньший лимит с 10 заданиями не влезает.
const MAX_TOKENS = 16000
// «Думающие» модели пишут рассуждения в тот же лимит и без потолка
// исчерпывают его целиком, не дойдя до ответа. Полностью выключать их нельзя:
// Claude такой запрос отклоняет, а бесплатные модели без рассуждений мешают
// русский с другими языками. Лимит в токенах Claude игнорирует, слушает только
// уровень усилий. Для Claude ниже «high» ставить нельзя: на «low» и «medium» он
// чаще всего не рассуждает вовсе и тогда правит себя прямо в тексте — «листья
// опадаются», «Нет, перепиши так…» в условии задания. Минута ожидания — цена
// верных заданий. Уровень задаётся настройкой AI_REASONING_EFFORT: у другой
// модели он может быть другим, и подбирать его надо вместе с AI_MODEL.

/**
 * Генерация через любой OpenAI-совместимый API (по умолчанию OpenRouter).
 * Провайдер и модель меняются переменными окружения, без правки кода.
 */
@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name)
  private readonly apiKey: string | undefined
  private readonly baseUrl: string
  private readonly model: string
  private readonly isOpenRouter: boolean
  private readonly effort: ReasoningEffort

  constructor(config: ConfigService) {
    this.apiKey = config.get<string>('AI_API_KEY') || undefined
    this.baseUrl = (config.get<string>('AI_BASE_URL') || 'https://openrouter.ai/api/v1').replace(/\/$/, '')
    this.model = config.get<string>('AI_MODEL') || 'nvidia/nemotron-3-super-120b-a12b:free'
    this.isOpenRouter = this.baseUrl.includes('openrouter.ai')
    this.effort = reasoningEffort(config.get('AI_REASONING_EFFORT'))
    this.logger.log(`ИИ: модель ${this.model}, рассуждения ${this.effort}`)
    if (!this.apiKey) {
      this.logger.warn('AI_API_KEY не задан — материалы урока собираются из шаблона')
    }
  }

  async generate(input: PromptInput): Promise<Generated> {
    if (!this.apiKey) {
      return { content: templateContent(input.topic, input.homeworkCount), model: 'template' }
    }

    const messages = buildMessages(input)
    for (let attempt = 1; attempt <= ATTEMPTS; attempt++) {
      const raw = await this.complete(messages)
      const content = raw ? parseContent(raw) : null
      if (content) return { content, model: this.model }
      this.logger.warn(`Ответ ИИ не разобран (попытка ${attempt}): ${raw?.slice(0, 300)}`)
    }
    throw new ServiceUnavailableException('ИИ не справился с ответом. Попробуйте ещё раз')
  }

  /** Есть ли ИИ: без ключа проверять ответы нечем. */
  get enabled(): boolean {
    return Boolean(this.apiKey)
  }

  /** Один запрос к модели: текст ответа или null. */
  ask(messages: ReturnType<typeof buildMessages>): Promise<string | null> {
    return this.complete(messages)
  }

  private async complete(messages: ReturnType<typeof buildMessages>): Promise<string | null> {
    let res: Response
    try {
      res = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${this.apiKey}`,
          // Необязательные заголовки OpenRouter: название приложения в его статистике
          'x-title': 'Tutor CRM',
        },
        body: JSON.stringify({
          model: this.model,
          messages,
          temperature: 0.4,
          max_tokens: MAX_TOKENS,
          // Параметр OpenRouter. Другим провайдерам не шлём:
          // незнакомое поле они могут отклонить.
          ...(this.isOpenRouter && this.effort !== 'none' ? { reasoning: { effort: this.effort } } : {}),
        }),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      })
    } catch (e) {
      this.logger.error(`ИИ недоступен: ${(e as Error).message}`)
      throw new ServiceUnavailableException('ИИ не ответил. Попробуйте ещё раз через минуту')
    }

    if (!res.ok) {
      const body = await res.text().catch(() => '')
      this.logger.error(`ИИ ответил ${res.status}: ${body.slice(0, 500)}`)
      // 429 — лимит бесплатной модели: повтор сразу не поможет
      throw new ServiceUnavailableException(
        res.status === 429
          ? 'Бесплатный лимит ИИ исчерпан. Попробуйте через несколько минут'
          : 'ИИ не ответил. Попробуйте ещё раз через минуту',
      )
    }

    const data = (await res.json()) as {
      choices?: { message?: { content?: string }; finish_reason?: string }[]
    }
    const choice = data.choices?.[0]
    if (choice?.finish_reason === 'length') {
      this.logger.warn(`Ответ ИИ обрезан по лимиту токенов (${MAX_TOKENS})`)
    }
    return choice?.message?.content ?? null
  }
}
