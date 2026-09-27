import { createHmac } from 'node:crypto'
import { InitDataError, verifyInitData } from './init-data'

const BOT_TOKEN = '123456:TEST_TOKEN_FOR_UNIT_TESTS_ONLY_abcdef'

/** Собирает корректно подписанный initData — как это делает Telegram. */
function signInitData(
  fields: Record<string, string>,
  token = BOT_TOKEN,
): string {
  const dataCheckString = Object.keys(fields)
    .sort()
    .map((k) => `${k}=${fields[k]}`)
    .join('\n')

  const secret = createHmac('sha256', 'WebAppData').update(token).digest()
  const hash = createHmac('sha256', secret).update(dataCheckString).digest('hex')

  const params = new URLSearchParams(fields)
  params.set('hash', hash)
  return params.toString()
}

const validUser = JSON.stringify({
  id: 7500000123,
  first_name: 'Влад',
  last_name: 'Волков',
  username: 'vlad',
  language_code: 'ru',
  is_premium: true,
})

function nowSeconds(): number {
  return Math.floor(Date.now() / 1000)
}

describe('verifyInitData', () => {
  it('принимает корректно подписанные данные', () => {
    const raw = signInitData({ user: validUser, auth_date: String(nowSeconds()) })
    const result = verifyInitData(raw, BOT_TOKEN)

    expect(result.user.id).toBe(7500000123)
    expect(result.user.firstName).toBe('Влад')
    expect(result.user.username).toBe('vlad')
    expect(result.user.isPremium).toBe(true)
  })

  it('читает start_param из deep link', () => {
    const raw = signInitData({
      user: validUser,
      auth_date: String(nowSeconds()),
      start_param: 'abc123',
    })
    expect(verifyInitData(raw, BOT_TOKEN).startParam).toBe('abc123')
  })

  // ─── Главное: подделки должны отклоняться ───

  it('отклоняет подмену tgId при сохранённой подписи', () => {
    const raw = signInitData({ user: validUser, auth_date: String(nowSeconds()) })
    // Атака: взять чужой валидный initData и подставить свой id.
    const tampered = raw.replace('7500000123', '9999999999')

    expect(() => verifyInitData(tampered, BOT_TOKEN)).toThrow(InitDataError)
  })

  it('отклоняет подпись, сделанную другим токеном', () => {
    const raw = signInitData({ user: validUser, auth_date: String(nowSeconds()) }, '999:OTHER_TOKEN')
    expect(() => verifyInitData(raw, BOT_TOKEN)).toThrow(/подпись/i)
  })

  it('отклоняет данные без hash', () => {
    const params = new URLSearchParams({ user: validUser, auth_date: String(nowSeconds()) })
    expect(() => verifyInitData(params.toString(), BOT_TOKEN)).toThrow(/hash/i)
  })

  it('отклоняет hash неверного формата', () => {
    const raw = signInitData({ user: validUser, auth_date: String(nowSeconds()) })
    const broken = raw.replace(/hash=[0-9a-f]{64}/, 'hash=zzz')
    expect(() => verifyInitData(broken, BOT_TOKEN)).toThrow(/формат hash/i)
  })

  it('отклоняет просроченные данные', () => {
    const twoDaysAgo = nowSeconds() - 2 * 86_400
    const raw = signInitData({ user: validUser, auth_date: String(twoDaysAgo) })
    expect(() => verifyInitData(raw, BOT_TOKEN)).toThrow(/просрочен/i)
  })

  it('принимает данные на границе окна жизни', () => {
    const raw = signInitData({ user: validUser, auth_date: String(nowSeconds() - 3600) })
    expect(() => verifyInitData(raw, BOT_TOKEN, 7200)).not.toThrow()
  })

  it('отклоняет auth_date из будущего', () => {
    const raw = signInitData({ user: validUser, auth_date: String(nowSeconds() + 3600) })
    expect(() => verifyInitData(raw, BOT_TOKEN)).toThrow(/будущем/i)
  })

  it('отклоняет пустую строку', () => {
    expect(() => verifyInitData('', BOT_TOKEN)).toThrow(/пустой/i)
  })

  it('отклоняет чрезмерно длинный вход', () => {
    expect(() => verifyInitData('x'.repeat(9000), BOT_TOKEN)).toThrow(/длинный/i)
  })

  it('отклоняет данные без user', () => {
    const raw = signInitData({ auth_date: String(nowSeconds()), chat_instance: '123' })
    expect(() => verifyInitData(raw, BOT_TOKEN)).toThrow(/нет user/i)
  })

  it('отклоняет user с некорректным id', () => {
    const raw = signInitData({
      user: JSON.stringify({ id: 'not-a-number', first_name: 'X' }),
      auth_date: String(nowSeconds()),
    })
    expect(() => verifyInitData(raw, BOT_TOKEN)).toThrow(/user\.id/i)
  })

  it('отклоняет user без first_name', () => {
    const raw = signInitData({
      user: JSON.stringify({ id: 123 }),
      auth_date: String(nowSeconds()),
    })
    expect(() => verifyInitData(raw, BOT_TOKEN)).toThrow(/first_name/i)
  })

  it('отклоняет битый JSON в user', () => {
    const raw = signInitData({ user: '{broken', auth_date: String(nowSeconds()) })
    expect(() => verifyInitData(raw, BOT_TOKEN)).toThrow(/JSON/i)
  })

  it('игнорирует поле signature при подсчёте HMAC', () => {
    // Telegram добавляет signature для Ed25519-схемы; в HMAC оно не входит.
    const raw = signInitData({ user: validUser, auth_date: String(nowSeconds()) })
    const withSignature = `${raw}&signature=abc_def-123`
    expect(() => verifyInitData(withSignature, BOT_TOKEN)).not.toThrow()
  })

  it('не теряет данные при спецсимволах в имени', () => {
    const tricky = JSON.stringify({ id: 42, first_name: 'A&B=C\nD', username: 'u' })
    const raw = signInitData({ user: tricky, auth_date: String(nowSeconds()) })
    expect(verifyInitData(raw, BOT_TOKEN).user.firstName).toBe('A&B=C\nD')
  })
})
