import { SetMetadata } from '@nestjs/common'

export const IS_PUBLIC_KEY = 'isPublic'

/**
 * Помечает роут открытым.
 *
 * Guard включён глобально, поэтому по умолчанию защищено всё:
 * забыть поставить защиту невозможно, можно только осознанно снять.
 */
export const Public = (): MethodDecorator & ClassDecorator =>
  SetMetadata(IS_PUBLIC_KEY, true)
