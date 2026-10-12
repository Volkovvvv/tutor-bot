/**
 * Откуда пришёл репетитор.
 *
 * Метка едет в deep link: t.me/<bot>?start=src_<метка> (бот)
 * или t.me/<bot>/<app>?startapp=src_<метка> (мини-апп). Если ссылки не было,
 * бот спрашивает сам — ответ хранится в том же поле с приставкой self_.
 */

// Префикс отделяет метку от кода приглашения ученика: тот же параметр /start
const LABEL = /^src_([a-z0-9][a-z0-9-]{0,30})$/;

/** Метка из параметра ссылки; null — это не метка источника. */
export function parseSource(payload: string | undefined | null): string | null {
  const match = LABEL.exec((payload ?? "").trim().toLowerCase());
  return match ? match[1] : null;
}

/** Варианты ответа на вопрос бота: код → подпись кнопки. */
export const SELF_SOURCES: Record<string, string> = {
  colleague: "От коллеги",
  chat: "Чат или канал",
  social: "Соцсети",
  search: "Поиск",
  other: "Другое",
};

const SELF = "self_";

/** Значение поля source для ответа на вопрос бота; null — такого варианта нет. */
export function selfSource(code: string): string | null {
  return Object.hasOwn(SELF_SOURCES, code) ? `${SELF}${code}` : null;
}

/** Подпись источника для сводки: ответ репетитора — словами, метка ссылки — как есть. */
export function sourceLabel(source: string): string {
  const code = source.startsWith(SELF) ? source.slice(SELF.length) : null;
  const label =
    code !== null && Object.hasOwn(SELF_SOURCES, code)
      ? SELF_SOURCES[code]
      : null;
  return label ? `${label.toLowerCase()} (ответ)` : `ссылка ${source}`;
}
