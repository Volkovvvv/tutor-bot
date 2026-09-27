import { randomInt } from 'node:crypto'

/**
 * Код приглашения для deep link t.me/<bot>?start=<code>.
 *
 * Telegram разрешает в start-параметре только A-Z a-z 0-9 _ - и до 64
 * символов. Берём подмножество без похожих глифов: код иногда
 * переписывают руками, и «0/O», «1/l/I» в этом случае гарантируют ошибку.
 */
const ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789'

/**
 * 16 символов из алфавита в 31 знак — это ~79 бит энтропии.
 *
 * Длина выбрана не «на глаз»: код даёт право привязаться к карточке
 * ученика, то есть это secret. При 10 символах (~50 бит) подбор ещё
 * мыслим, при 16 — нет, а ссылка остаётся приемлемой на вид.
 */
const CODE_LENGTH = 16

/**
 * randomInt из node:crypto, а не Math.random: последний предсказуем
 * по нескольким выданным значениям, и зная один код можно было бы
 * вычислить следующие.
 *
 * randomInt(max) даёт равномерное распределение без modulo bias —
 * при `bytes[i] % 31` первые символы алфавита выпадали бы чаще.
 */
export function generateInviteCode(): string {
  let code = ''
  for (let i = 0; i < CODE_LENGTH; i += 1) {
    code += ALPHABET[randomInt(ALPHABET.length)]
  }
  return code
}

/**
 * Проверяет форму кода перед обращением к базе.
 *
 * Бот принимает /start от любого человека в Telegram, поэтому в аргумент
 * прилетает что угодно — включая попытки SQL-инъекций и гигантские строки.
 */
export function isValidInviteCodeFormat(value: unknown): value is string {
  return typeof value === 'string' && new RegExp(`^[${ALPHABET}]{${CODE_LENGTH}}$`).test(value)
}
