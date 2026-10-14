// Границы совпадают с проверкой на сервере (api/src/lessons/dto): 5–600 минут.
export const MIN_DURATION = 5
export const MAX_DURATION = 600
export const DEFAULT_DURATION = 60

export function isValidDuration(value) {
  return Number.isInteger(value) && value >= MIN_DURATION && value <= MAX_DURATION
}
