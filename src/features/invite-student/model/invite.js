import { BOT_USERNAME } from '../../../shared/config/bot.js'

// Код приглашения кладётся в deep link и возвращается боту в /start <code>.
// По нему бэкенд поймёт, какому ученику принадлежит написавший человек.
// Телеграм разрешает в start_param только A-Z a-z 0-9 _ - и до 64 символов.
export function generateInviteCode() {
  const alphabet = 'abcdefghijklmnopqrstuvwxyz0123456789'
  let code = ''
  const bytes = new Uint8Array(10)
  if (globalThis.crypto?.getRandomValues) {
    globalThis.crypto.getRandomValues(bytes)
    for (const b of bytes) code += alphabet[b % alphabet.length]
  } else {
    for (let i = 0; i < 10; i += 1) {
      code += alphabet[Math.floor(Math.random() * alphabet.length)]
    }
  }
  return code
}

export function inviteLink(code) {
  return `https://t.me/${BOT_USERNAME}?start=${code}`
}

export function inviteMessage(student, code) {
  return (
    `${student.name}, привет! Я буду присылать напоминания о занятиях через бота.\n\n` +
    `Нажмите ссылку и кнопку «Начать» — этого достаточно:\n${inviteLink(code)}`
  )
}
