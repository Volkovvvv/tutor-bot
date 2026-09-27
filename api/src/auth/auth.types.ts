/** Полезная нагрузка JWT. Только идентификаторы — ничего лишнего. */
export interface JwtPayload {
  /** User.id */
  sub: string
  /** Tutor.id — кладём в токен, чтобы не искать кабинет на каждом запросе. */
  tid: string
}

/** Пользователь, добавленный guard'ом в request. */
export interface AuthUser {
  userId: string
  tutorId: string
}
