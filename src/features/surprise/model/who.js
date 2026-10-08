// Сюрприз для одного человека. Вопрос «Вас зовут Анна Волкова?» показываем
// не всем подряд, а тем, чьё имя в Telegram на это похоже: остальным
// репетиторам такой попап при входе ни к чему.
// С начала имени: иначе под «анна» попала бы и Жанна
const NAME = /^\s*(анна|аня|анют|анечк|anna|anya|ania)/i
const SURNAME = /(волков|volkov)/i

const SEEN_KEY = 'tutor-crm:surprise-seen'

/** Похож ли человек на Анну Волкову: по имени и фамилии из Telegram и по username. */
export function looksLikeAnna({ firstName = '', lastName = '', username = '' } = {}) {
  const full = `${firstName} ${lastName}`
  return SURNAME.test(full) || SURNAME.test(username) || NAME.test(firstName)
}

export function wasSeen() {
  try {
    return localStorage.getItem(SEEN_KEY) !== null
  } catch {
    return false
  }
}

export function markSeen() {
  try {
    localStorage.setItem(SEEN_KEY, '1')
  } catch {
    // приватный режим — покажем ещё раз, не страшно
  }
}
