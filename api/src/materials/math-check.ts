/**
 * Проверка ключа по математике подстановкой — без модели.
 * Без Nest и базы — чтобы проверять тестами.
 *
 * Формулы берутся из текста, который видит ученик: уравнение или неравенство —
 * из условия, ответ — из ключа. Дальше условие и ответ сравниваются в точках:
 * в корнях, между ними и по краям. Совпали везде — ключ верен; нет — в пометке
 * стоит число, которое репетитор подставит и проверит сам.
 *
 * Что берётся: уравнение или неравенство с одной переменной (в том числе
 * вопрос о корнях — наибольший, сумма, сколько), система двух уравнений,
 * «вычисли» и тождественные преобразования — «упрости», «разложи на множители».
 * Только то, что читается однозначно; всё остальное — null, и задание уходит
 * на обычную проверку моделью. Ложная пометка хуже пропуска.
 */

type Num = (x: number) => number
type Cond = (x: number) => boolean

export type MathVerdict = { ok: true } | { ok: false; note: string }

// ─── Разбор формулы ───

type Tok = { k: 'num' | 'frac' | 'log'; v: number; gap: boolean } | { k: 'id' | 'op' | 'rel'; v: string; gap: boolean }

const SUP: Record<string, string> = {
  '⁰': '0', '¹': '1', '²': '2', '³': '3', '⁴': '4', '⁵': '5', '⁶': '6', '⁷': '7', '⁸': '8', '⁹': '9', '⁻': '-', '⁺': '+',
}

/** Школьная запись → запись, которую читает разбор: «2,5 · x² ≤ 1 1/2» → «2.5 * x^(2) <= (1+1/2)». */
function norm(s: string): string {
  return s
    .replace(/−/g, '-')
    .replace(/[·×⋅∙]/g, '*')
    .replace(/÷/g, '/')
    .replace(/≤/g, '<=')
    .replace(/≥/g, '>=')
    .replace(/≠/g, '!=')
    .replace(/(\d),(?=\d)/g, '$1.')
    .replace(/\s:\s/g, ' / ')
    .replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹⁻⁺]+/g, (m) => `^(${[...m].map((c) => SUP[c]).join('')})`)
    // Смешанное число «2 1/3»: без этого оно прочиталось бы как 2 · 1/3
    .replace(/(^|[^\d./])(\d+) (\d+)\/(\d+)(?![\d./])/g, '$1($2+$3/$4)')
}

const FUNCTIONS = new Set(['sin', 'cos', 'tg', 'ctg', 'tan', 'cot', 'sec', 'exp', 'lim', 'max', 'min', 'mod', 'arc'])

function tokenize(src: string): Tok[] {
  const out: Tok[] = []
  let i = 0
  let gap = false
  const at = (re: RegExp) => {
    re.lastIndex = i
    return re.exec(src)
  }
  while (i < src.length) {
    let m: RegExpExecArray | null
    if ((m = at(/\s+/y))) {
      gap = true
      i += m[0].length
      continue
    }
    const prev = out[out.length - 1]
    // «3/4» без пробелов — дробь: в «3/4 : 1/2» она считается раньше деления.
    // После «^» дробью не считаем: «2^1/2» читают и так, и так.
    if (!(prev?.k === 'op' && prev.v === '^') && (m = at(/(\d+)\/(\d+)(?![\d.])/y))) {
      out.push({ k: 'frac', v: Number(m[1]) / Number(m[2]), gap })
    } else if ((m = at(/\d+(?:\.\d+)?/y))) {
      out.push({ k: 'num', v: Number(m[0]), gap })
    } else if ((m = at(/log([₀-₉]+)|lg|ln/y))) {
      // Основание логарифма — подстрочными цифрами: log₂; lg — десятичный, ln — натуральный
      const base = m[1] ? Number([...m[1]].map((c) => c.charCodeAt(0) - 0x2080).join('')) : m[0] === 'lg' ? 10 : Math.E
      out.push({ k: 'log', v: base, gap })
    } else if ((m = at(/[a-zA-Z]+/y))) {
      // «2ab» — произведение букв; sin, cos и прочие функции не читаем
      if (m[0].length > 3 || FUNCTIONS.has(m[0].toLowerCase())) throw new Error('функции не читаем')
      for (const [n, letter] of [...m[0]].entries()) out.push({ k: 'id', v: letter, gap: n === 0 && gap })
    } else if ((m = at(/<=|>=|!=|<|>|=/y))) {
      out.push({ k: 'rel', v: m[0], gap })
    } else if ((m = at(/[+\-*/^()|√]/y))) {
      out.push({ k: 'op', v: m[0], gap })
    } else {
      throw new Error(`непонятный знак «${src[i]}»`)
    }
    i += m[0].length
    gap = false
  }
  return out
}

interface Node {
  fn: Num
  /** Имя переменной, если это она одна и есть: «x». */
  bare: string | null
  hasVar: boolean
  /** Дробь, корень из числа или логарифм: умножение без знака сразу за ними читается двояко. */
  tight?: boolean
}

class Parser {
  private i = 0
  private abs = 0
  readonly vars = new Set<string>()
  /** Значения переменных по именам — когда их несколько; null — переменная одна, её значение приходит аргументом. */
  bind: Record<string, number> | null = null

  constructor(private readonly t: Tok[]) {}

  get done(): boolean {
    return this.i >= this.t.length
  }
  peek(): Tok | undefined {
    return this.t[this.i]
  }
  skip(): void {
    this.i++
  }
  private isOp(v: string): boolean {
    const tk = this.peek()
    return tk?.k === 'op' && tk.v === v
  }
  private eat(v: string): void {
    if (!this.isOp(v)) throw new Error(`ждали «${v}»`)
    this.i++
  }

  sum(): Node {
    let left = this.term()
    while (this.isOp('+') || this.isOp('-')) {
      const minus = this.isOp('-')
      this.i++
      const a = left
      const b = this.term()
      left = {
        fn: minus ? (x) => a.fn(x) - b.fn(x) : (x) => a.fn(x) + b.fn(x),
        bare: null,
        hasVar: a.hasVar || b.hasVar,
      }
    }
    return left
  }

  private term(): Node {
    let left = this.unary()
    let afterDiv = false
    for (;;) {
      const tk = this.peek()
      if (!tk) break
      if (tk.k === 'op' && (tk.v === '*' || tk.v === '/')) {
        this.i++
        const a = left
        const b = this.unary()
        const div = tk.v === '/'
        left = { fn: div ? (x) => a.fn(x) / b.fn(x) : (x) => a.fn(x) * b.fn(x), bare: null, hasVar: a.hasVar || b.hasVar }
        afterDiv = div
        continue
      }
      // Умножение без знака: «8x», «(x − 2)(x − 7)», «2√3»
      const opens =
        tk.k === 'id' || tk.k === 'log' || (tk.k === 'op' && (tk.v === '(' || tk.v === '√' || (tk.v === '|' && this.abs === 0)))
      if (!opens) break
      // «1/2x» и «√2x» читают по-разному — не угадываем
      if (afterDiv || (left.tight && !tk.gap)) throw new Error('двусмысленная запись')
      const a = left
      const b = this.power()
      left = { fn: (x) => a.fn(x) * b.fn(x), bare: null, hasVar: a.hasVar || b.hasVar }
    }
    return left
  }

  private unary(): Node {
    if (this.isOp('-')) {
      this.i++
      const a = this.unary()
      return { fn: (x) => -a.fn(x), bare: null, hasVar: a.hasVar }
    }
    if (this.isOp('+')) {
      this.i++
      return this.unary()
    }
    return this.power()
  }

  private power(): Node {
    const base = this.atom()
    if (!this.isOp('^')) return base
    this.i++
    const exp = this.exponent()
    return { fn: (x) => Math.pow(base.fn(x), exp.fn(x)), bare: null, hasVar: base.hasVar || exp.hasVar }
  }

  private exponent(): Node {
    if (this.isOp('-')) {
      this.i++
      const a = this.exponent()
      return { fn: (x) => -a.fn(x), bare: null, hasVar: a.hasVar }
    }
    return this.power()
  }

  private atom(): Node {
    const tk = this.peek()
    if (!tk) throw new Error('формула оборвана')
    this.i++
    if (tk.k === 'num' || tk.k === 'frac') {
      const v = tk.v
      return { fn: () => v, bare: null, hasVar: false, tight: tk.k === 'frac' }
    }
    if (tk.k === 'log') {
      const base = Math.log(tk.v)
      const a = this.atom()
      // «log₃²x» и «log₂x²» читают по-разному
      if (this.isOp('^')) throw new Error('двусмысленная запись')
      return { fn: (x) => Math.log(a.fn(x)) / base, bare: null, hasVar: a.hasVar, tight: true }
    }
    if (tk.k === 'id') {
      const name = tk.v
      this.vars.add(name)
      return { fn: (x) => (this.bind ? (this.bind[name] ?? NaN) : x), bare: name, hasVar: true }
    }
    if (tk.k === 'op' && tk.v === '(') {
      const inner = this.sum()
      this.eat(')')
      return { ...inner, bare: null, tight: false }
    }
    if (tk.k === 'op' && tk.v === '√') {
      const a = this.atom()
      // «√x²» — корень из квадрата или квадрат корня?
      if (this.isOp('^')) throw new Error('двусмысленная запись')
      return { fn: (x) => Math.sqrt(a.fn(x)), bare: null, hasVar: a.hasVar, tight: !a.hasVar }
    }
    if (tk.k === 'op' && tk.v === '|') {
      this.abs++
      const inner = this.sum()
      this.eat('|')
      this.abs--
      return { fn: (x) => Math.abs(inner.fn(x)), bare: null, hasVar: inner.hasVar }
    }
    throw new Error('ждали число или переменную')
  }
}

/** Сравнение с допуском: корни найдены приближённо, а «<» и «≤» на границе различаться должны. */
function holds(op: string, l: number, r: number): boolean {
  if (!Number.isFinite(l) || !Number.isFinite(r)) return false
  const d = l - r
  const tol = 1e-9 * (1 + Math.abs(l) + Math.abs(r))
  switch (op) {
    case '=':
      return Math.abs(d) <= tol
    case '!=':
      return Math.abs(d) > tol
    case '<':
      return d < -tol
    case '<=':
      return d <= tol
    case '>':
      return d > tol
    default:
      return d >= -tol
  }
}

type Env = Record<string, number>

interface Rel {
  cond: Cond
  /** То же при заданных значениях нескольких переменных. */
  at: (env: Env) => boolean
  /** Левая часть минус правая у первого сравнения при заданных значениях. */
  diffAt: (env: Env) => number
  /** Левая часть минус правая у каждого сравнения: по их корням ищем точки для проверки. */
  diffs: Num[]
  vars: Set<string>
  ops: string[]
  /** Переменная одна стоит с одной стороны, с других — числа: «x < 2», «−1 ≤ x ≤ 5». */
  simple: boolean
}

function withEnv<T>(p: Parser, env: Env, read: () => T): T {
  p.bind = env
  try {
    return read()
  } finally {
    p.bind = null
  }
}

/** Выражение без знаков сравнения; null — не прочиталось. */
function parseNum(src: string): { fn: Num; vars: Set<string>; at: (env: Env) => number } | null {
  try {
    const p = new Parser(tokenize(norm(src)))
    const node = p.sum()
    return p.done ? { fn: node.fn, vars: p.vars, at: (env) => withEnv(p, env, () => node.fn(0)) } : null
  } catch {
    return null
  }
}

/** Уравнение, неравенство или цепочка «a < x ≤ b»; null — не прочиталось. */
function parseRel(src: string): Rel | null {
  try {
    const p = new Parser(tokenize(norm(src)))
    const sides = [p.sum()]
    const ops: string[] = []
    while (!p.done) {
      const tk = p.peek()
      if (tk?.k !== 'rel') return null
      ops.push(tk.v)
      p.skip()
      sides.push(p.sum())
    }
    if (ops.length === 0) return null
    const cond: Cond = (x) => ops.every((op, i) => holds(op, sides[i].fn(x), sides[i + 1].fn(x)))
    return {
      cond,
      at: (env) => withEnv(p, env, () => cond(0)),
      diffAt: (env) => withEnv(p, env, () => sides[0].fn(0) - sides[1].fn(0)),
      diffs: ops.map((_, i) => (x: number) => sides[i].fn(x) - sides[i + 1].fn(x)),
      vars: p.vars,
      ops,
      simple: sides.filter((s) => s.bare).length === 1 && sides.every((s) => s.bare || !s.hasVar),
    }
  } catch {
    return null
  }
}

// ─── Сравнение условия и ответа в точках ───

/** 1,9999999 → 2; 0,33333333 → 1/3: чтобы «x = −3» и найденный корень были одной точкой. */
function snap(x: number): number {
  for (let q = 1; q <= 12; q++) {
    const p = Math.round(x * q)
    if (Math.abs(x - p / q) < 1e-7) return p / q
  }
  return x
}

function bisect(sign: (x: number) => boolean, a: number, b: number): number {
  let lo = a
  let hi = b
  const start = sign(lo)
  for (let k = 0; k < 80; k++) {
    const mid = (lo + hi) / 2
    if (sign(mid) === start) lo = mid
    else hi = mid
  }
  return (lo + hi) / 2
}

const GRID = 20000

/** Корни и границы области определения f на [−R; R]. Лишняя точка не страшна: это только места проверки. */
function roots(f: Num, R: number): number[] {
  const out: number[] = []
  const step = (2 * R) / GRID
  let xm = NaN
  let fm = NaN
  let x0 = -R
  let f0 = f(x0)
  for (let i = 1; i <= GRID; i++) {
    const x1 = -R + i * step
    const f1 = f(x1)
    const fin0 = Number.isFinite(f0)
    const fin1 = Number.isFinite(f1)
    if (fin0 !== fin1) {
      out.push(bisect((x) => Number.isFinite(f(x)), x0, x1))
    } else if (fin0 && fin1) {
      if (f1 === 0) out.push(x1)
      else if (f0 * f1 < 0) out.push(bisect((x) => f(x) > 0, x0, x1))
      else if (Number.isFinite(fm) && f0 !== 0) {
        // Знак не сменился, но значение подошло к нулю и ушло: кратный корень или два корня между узлами
        const s = f0 > 0 ? 1 : -1
        if (s * fm > 0 && s * f1 > 0 && s * f0 < s * fm && s * f0 <= s * f1) {
          let lo = xm
          let hi = x1
          for (let k = 0; k < 60; k++) {
            const a = lo + (hi - lo) / 3
            const b = hi - (hi - lo) / 3
            if (s * f(a) < s * f(b)) hi = b
            else lo = a
          }
          const m = (lo + hi) / 2
          const v = s * f(m)
          if (v < 0) out.push(bisect((x) => f(x) > 0, xm, m), bisect((x) => f(x) > 0, m, x1))
          else if (v <= 1e-9 * Math.max(1, Math.abs(fm), Math.abs(f1))) out.push(m)
        }
      }
    }
    xm = x0
    fm = f0
    x0 = x1
    f0 = f1
  }
  return out.map(snap)
}

interface Side {
  cond: Cond
  diffs: Num[]
}

/** Точка, где условие и ответ расходятся; null — совпали везде, где смотрели. */
function firstDifference(task: Side, answer: Side): { x: number; inTask: boolean } | null {
  // Сначала ответ: его корни — числа из ключа, они точны. Корень условия рядом с ними подтягиваем к ним.
  const exact = answer.diffs.flatMap((f) => roots(f, 1000))
  const reach = Math.min(1e6, Math.max(1000, ...exact.map((x) => Math.abs(x) * 4)))
  const found = task.diffs.flatMap((f) => roots(f, reach)).map((x) => exact.find((e) => Math.abs(e - x) < 1e-6) ?? x)
  const crit = [...new Set([...exact, ...found])].filter(Number.isFinite).sort((a, b) => a - b)

  const points = [...crit]
  for (let i = 1; i < crit.length; i++) points.push((crit[i - 1] + crit[i]) / 2)
  if (crit.length) points.push(crit[0] - 1, crit[crit.length - 1] + 1)
  for (let n = -30; n <= 30; n++) points.push(n, n + 0.5)
  points.push(-reach, reach)

  const differ = points.filter((x) => task.cond(x) !== answer.cond(x))
  if (differ.length === 0) return null
  // Показываем число, которое проще подставить: целое и поменьше
  differ.sort((a, b) => Number(!Number.isInteger(a)) - Number(!Number.isInteger(b)) || Math.abs(a) - Math.abs(b))
  return { x: differ[0], inTask: task.cond(differ[0]) }
}

function show(x: number): string {
  const rounded = Math.round(x * 1e4) / 1e4
  return String(rounded).replace('.', ',').replace('-', '−')
}

// ─── Ответ из ключа ───

const ALL = /^(?:[a-z]\s*[—–-]\s*)?(?:любое|любые|все)(?:\s+(?:действительн|вещественн)[а-я]+)?\s+(?:число|числа|значения(?:\s+[a-z])?)$|^вся числовая (?:прямая|ось)$/
const NONE = /^(?:нет решений|решений нет|(?:действительных )?корней нет|нет (?:действительных )?корней|пустое множество)$/

/** Итог из ключа: то, что после «Ответ:», или первое предложение. */
function answerPart(key: string): string {
  const marks = [...key.matchAll(/ответ\s*:\s*/gi)]
  const last = marks[marks.length - 1]
  const from = last ? key.slice((last.index ?? 0) + last[0].length) : key
  const end = from.search(/\.(?:\s|$)|\n/)
  return (end === -1 ? from : from.slice(0, end)).trim()
}

type Clause = Side & { kind: 'eq' | 'ineq' | 'set' }

/**
 * Ответ как условие на переменную: «x < 2 или x > 7», «x₁ = 2, x₂ = 5»,
 * «[2; 6]», «решений нет». null — ответ записан иначе.
 */
function parseAnswer(raw: string, v: string, bareRoots: boolean): Side | null {
  const text = raw.replace(/[₀-₉]/g, '').replace(/ё/g, 'е').toLowerCase().trim()
  if (ALL.test(text)) return { cond: () => true, diffs: [] }
  if (NONE.test(text)) return { cond: () => false, diffs: [] }

  // Промежутки: «[2; 6]», «(−∞; 2)»
  const sets: Clause[] = []
  let bad = false
  const edge = (s: string): number | null => {
    const t = s.replace(/−/g, '-').replace(/\s/g, '')
    if (t === '-∞') return -Infinity
    if (t === '∞' || t === '+∞') return Infinity
    const num = parseNum(s)
    return num && num.vars.size === 0 && Number.isFinite(num.fn(0)) ? num.fn(0) : null
  }
  const withSets = norm(text).replace(/([[(])([^;[\]()а-я]+);([^;[\]()а-я]+)([\])])/g, (_, open: string, a: string, b: string, close: string) => {
    const lo = edge(a)
    const hi = edge(b)
    if (lo === null || hi === null) {
      bad = true
      return ''
    }
    const loOp = open === '[' ? '>=' : '>'
    const hiOp = close === ']' ? '<=' : '<'
    sets.push({
      kind: 'set',
      cond: (x) => (lo === -Infinity || holds(loOp, x, lo)) && (hi === Infinity || holds(hiOp, x, hi)),
      diffs: [lo, hi].filter(Number.isFinite).map((c) => (x: number) => x - c),
    })
    return ` @${sets.length - 1} `
  })
  if (bad) return null

  const body = withSets.replace(/[a-z]\s*(?:принадлежит|∈|из)\s*(?:(?:промежутку|отрезку|интервалу|лучу|множеству)\s*)?(?=@)/g, '')
  const parts = body.split(/(\s+(?:или|либо|и|объединение)\s+|\s*∪\s*|\s*[;,]\s+)/)

  const clause = (src: string): Clause | null => {
    const s = src.trim()
    const set = /^@(\d+)$/.exec(s)
    if (set) return sets[Number(set[1])]

    const both = /^([a-z])\s*=\s*±\s*(.+)$/.exec(s)
    if (both) {
      const num = parseNum(both[2])
      if (both[1] !== v || !num || num.vars.size > 0) return null
      const c = num.fn(0)
      return { kind: 'eq', cond: (x) => holds('=', x, c) || holds('=', x, -c), diffs: [(x) => x - c, (x) => x + c] }
    }

    const rel = parseRel(s)
    if (rel) {
      if (!rel.simple || !rel.vars.has(v) || rel.vars.size !== 1) return null
      return { kind: rel.ops.every((op) => op === '=') ? 'eq' : 'ineq', cond: rel.cond, diffs: rel.diffs }
    }

    // «2 и 3» как корни уравнения
    const num = bareRoots ? parseNum(s) : null
    if (!num || num.vars.size > 0) return null
    const c = num.fn(0)
    return { kind: 'eq', cond: (x) => holds('=', x, c), diffs: [(x) => x - c] }
  }

  const clauses: Clause[] = []
  const joins: ('and' | 'or')[] = []
  for (let i = 0; i < parts.length; i += 2) {
    const c = clause(parts[i])
    if (!c) return null
    if (i > 0) {
      const sep = parts[i - 1].trim()
      const prev = clauses[clauses.length - 1]
      const ineqs = prev.kind === 'ineq' && c.kind === 'ineq'
      // «x > 2, x ≠ 5» — и, а «x = 2, x = 5» — или: запятую между неравенствами не угадываем
      if ((sep === ',' || sep === ';') && (prev.kind === 'ineq' || c.kind === 'ineq')) return null
      joins.push(sep === 'и' && ineqs ? 'and' : 'or')
    }
    clauses.push(c)
  }

  // «и» связывает сильнее, чем «или»
  const groups: Cond[][] = [[clauses[0].cond]]
  joins.forEach((join, i) => {
    if (join === 'and') groups[groups.length - 1].push(clauses[i + 1].cond)
    else groups.push([clauses[i + 1].cond])
  })
  return {
    cond: (x) => groups.some((g) => g.every((c) => c(x))),
    diffs: clauses.flatMap((c) => c.diffs),
  }
}

// ─── Условие из текста задания ───

const RUN = /[0-9a-zA-Z+\-−·×*÷/:^()|√.,<>≤≥=≠⁰¹²³⁴⁵⁶⁷⁸⁹⁻⁺₀-₉\s]+/g
const REL_SIGN = /[<>≤≥=≠]/
// «…принадлежащие отрезку [−2; 5]»: промежуток, которым условие ограничивает ответ
const WITHIN = /(?:принадлежащ[а-яё]+|на|из|в)\s+(?:отрезк[а-яё]+|промежутк[а-яё]+|интервал[а-яё]+)\s+([[(][^[\]()а-яё]*;[^[\]()а-яё]*[\])])/i

const wordSet = (list: string) => new Set(list.split(/\s+/).filter(Boolean))

// Слова, при которых задание — просто «реши». Любое другое слово («положительный»,
// «натуральные») меняет вопрос, и подстановка тут не судья.
const PLAIN = wordSet(`
  реши решите найди найдите укажи запиши определи выбери все решение решения решений корень корни уравнение уравнения
  неравенство неравенства значения значение при которых каких которые в ответ ответе номер варианта вариант
  верного верный правильного правильный множество методом интервалов выполняется верно
  и его к приведи стандартному виду используя теорему теореме виета по через дискриминант дискриминанта с помощью
  формулы формуле действительные действительных систему системы уравнений неравенств`)
// Вопрос не о множестве решений, а о числе: наибольший корень, сумма корней, сколько целых решений
const ABOUT_ROOTS = wordSet(`
  наибольший наибольшее наибольшего наименьший наименьшее наименьшего больший большее большего меньший меньшее меньшего
  из них сумму сумма произведение корней всех их если несколько более одного имеет то число количество сколько
  целых целое целые целый целого квадратов у этого`)
// Каким приёмом считать — на ответ не влияет: «…с помощью формулы разности кубов»
const METHOD = wordSet(`
  с помощью используя формулу формулы формуле формул по сокращенного умножения суммы разности кубов квадратов квадрата
  куба удобным способом`)
const VALUE = wordSet('вычисли найди найдите значение выражения выражение выполни действия действие посчитай сосчитай чему равно при если')
const IDENTITY = wordSet(`
  упрости выражение разложи на множители многочлен раскрой скобки приведи подобные слагаемые сократи дробь представь
  в виде многочлена произведения вынеси общий множитель за преобразуй выполни умножение возведение степень запиши
  стандартном стандартного вида и`)
const IDENTITY_VERB = /(?:^| )(?:упрости|разложи|раскрой|приведи подобные|сократи|представь|вынеси|преобразуй|выполни (?:умножение|возведение))/

const only = (words: string[], ...sets: Set<string>[]) => words.every((w) => sets.some((s) => s.has(w)))

interface Stem {
  relations: string[]
  expressions: string[]
  /** Русские слова условия: по ним видно, о чём спрашивают. */
  words: string[]
  within: string | null
}

function readStem(stem: string): Stem {
  let within: string | null = null
  const text = stem.replace(WITHIN, (_, set: string) => {
    within = set
    return ' '
  })
  const relations: string[] = []
  const expressions: string[] = []
  for (const m of text.matchAll(RUN)) {
    // «x + y = 5, x − y = 1» и «при a = 2, b = 3» — несколько записей в одной строке
    for (const piece of m[0].split(/[,;]\s+|\n/)) {
      const run = piece.replace(/^[\s.,:;]+|[\s.,:;]+$/g, '')
      if (!/[0-9a-zA-Z]/.test(run) || /^[a-zA-Z]$/.test(run)) continue
      if (REL_SIGN.test(run)) relations.push(run)
      else expressions.push(run)
    }
  }
  const words = text.replace(RUN, ' ').toLowerCase().replace(/ё/g, 'е').match(/[а-я]+/g) ?? []
  return { relations, expressions, words, within }
}

/** «…\n1) x ≤ 2\n2) 2 < x < 6…» → условие и варианты ответа по порядку. */
function splitOptions(task: string): { stem: string; options: string[] } {
  const marks = [...task.matchAll(/(?:^|\s)([1-9])\)\s+/g)].filter((m, i) => Number(m[1]) === i + 1)
  if (marks.length < 2) return { stem: task, options: [] }

  let stem = task.slice(0, marks[0].index)
  const options = marks.map((m, i) => {
    const from = (m.index ?? 0) + m[0].length
    const rest = task.slice(from, i + 1 < marks.length ? marks[i + 1].index : undefined)
    // Вариант — до конца строки или до следующей фразы: «…x > 6. В ответ запиши номер»
    const end = rest.search(/\n|\.\s+[А-ЯЁ]/)
    if (end !== -1 && i === marks.length - 1) stem += ` ${rest.slice(end + 1)}`
    return (end === -1 ? rest : rest.slice(0, end)).trim().replace(/[.;]$/, '')
  })
  return { stem, options }
}

const numbersIn = (s: string) => (s.match(/\d+(?:[.,]\d+)?/g) ?? []).map((n) => n.replace(',', '.'))

/**
 * Сверяет ключ с условием подстановкой.
 *
 * result — итоговый ответ отдельной короткой записью, если модель его дала:
 * по нему сверяем, когда ключ начинается с решения и итог из него не достать.
 * null — задание не из тех, что читаются однозначно: его проверит модель.
 */
export function mathCheck(task: string, key: string, result?: string | null): MathVerdict | null {
  const fromKey = check(task, answerPart(key))
  if (fromKey || !result) return fromKey
  // Запись должна быть о том же, что и ключ, который увидит репетитор: все её числа в нём есть
  const inKey = new Set(numbersIn(key))
  if (!numbersIn(result).every((n) => inKey.has(n))) return null
  return check(task, result.trim().replace(/\.$/, ''))
}

function check(task: string, answer: string): MathVerdict | null {
  const { stem, options } = splitOptions(task)
  const { relations, expressions, words, within } = readStem(stem)

  if (expressions.length === 1 && options.length === 0 && !within) {
    const letters = /[a-zA-Z]/.test(expressions[0])
    if (relations.length === 0 && letters) {
      return IDENTITY_VERB.test(words.join(' ')) && only(words, IDENTITY, METHOD) ? checkIdentity(expressions[0], answer) : null
    }
    return only(words, VALUE, METHOD) ? checkValue(expressions[0], relations, answer) : null
  }
  if (relations.length === 0 || expressions.length > 0) return null

  const rels = relations.map(parseRel)
  if (!rels.every((r): r is Rel => r !== null)) return null
  const vars = [...new Set(rels.flatMap((r) => [...r.vars]))].sort()
  if (vars.length === 2) return options.length === 0 && !within && only(words, PLAIN) ? checkSystem(rels, vars, answer) : null
  if (vars.length !== 1) return null

  const v = vars[0]
  const equation = rels.every((r) => r.ops.every((op) => op === '='))
  // Несколько записей с одной переменной — система: должны выполняться все
  let given: Side = { cond: (x) => rels.every((r) => r.cond(x)), diffs: rels.flatMap((r) => r.diffs) }
  if (within) {
    const set = parseAnswer(within, v.toLowerCase(), false)
    if (!set) return null
    const inner = given
    given = { cond: (x) => inner.cond(x) && set.cond(x), diffs: [...inner.diffs, ...set.diffs] }
  }

  const question = aboutRoots(words)
  if (question === 'unclear') return null
  if (question) {
    return options.length === 0 && only(words, PLAIN, ABOUT_ROOTS) ? checkRoots(given, equation, question, answer) : null
  }
  if (!only(words, PLAIN)) return null

  if (options.length === 0) {
    const own = parseAnswer(answer, v.toLowerCase(), equation)
    if (!own) return null
    const diff = firstDifference(given, own)
    if (!diff) return { ok: true }
    return {
      ok: false,
      note: diff.inTask
        ? `Подстановка: ${v} = ${show(diff.x)} подходит под условие, а в ответ не входит.`
        : `Подстановка: ${v} = ${show(diff.x)} входит в ответ, а условию не удовлетворяет.`,
    }
  }

  const picked = /^(?:вариант\s*)?([1-9])\)?$/i.exec(answer)
  const n = picked ? Number(picked[1]) : 0
  if (n < 1 || n > options.length) return null
  const sides = options.map((o) => parseAnswer(o, v.toLowerCase(), equation))
  const chosen = sides[n - 1]
  if (!chosen) return null

  const diff = firstDifference(given, chosen)
  if (diff) {
    return {
      ok: false,
      note: diff.inTask
        ? `Подстановка: ${v} = ${show(diff.x)} подходит под условие, а в вариант ${n} не входит.`
        : `Подстановка: ${v} = ${show(diff.x)} входит в вариант ${n}, а условию не удовлетворяет.`,
    }
  }
  const also = sides.findIndex((s, i) => i !== n - 1 && s && !firstDifference(given, s))
  if (also !== -1) return { ok: false, note: `Подстановкой подходят два варианта: ${Math.min(n, also + 1)} и ${Math.max(n, also + 1)}.` }
  return { ok: true }
}

/**
 * Итог из ответа-цепочки «2,5 · 4 − 9 = 10 − 9 = 1» — то, что после последнего «=».
 * Цепочка должна начинаться с самого выражения из условия (same): иначе это
 * шаг решения вроде «3/4 = 9/12», и его правая часть — не ответ.
 * Слова в ответе — тоже признак решения, а не итога.
 */
function finalPart(answer: string, same: (first: string) => boolean): string | null {
  if (answer.includes('≈') || /[а-яё]/i.test(answer)) return null
  const parts = answer.split('=')
  if (parts.length > 1 && !same(parts[0])) return null
  return parts[parts.length - 1]
}

function constant(src: string | null): number | null {
  const own = src === null ? null : parseNum(src)
  if (!own || own.vars.size > 0) return null
  const value = own.fn(0)
  return Number.isFinite(value) ? value : null
}

/** «Вычисли: 3/4 + 1/6» и «Найди значение выражения 2x + 3 при x = 5». */
function checkValue(expression: string, assignments: string[], answer: string): MathVerdict | null {
  const given = parseNum(expression)
  if (!given || !/[+\-−·×*÷/:^√⁰¹²³⁴⁵⁶⁷⁸⁹a-zA-Z]/.test(expression)) return null

  const env: Env = {}
  for (const a of assignments) {
    const m = /^([a-zA-Z])\s*=\s*(.+)$/.exec(a)
    const value = m ? parseNum(m[2]) : null
    if (!m || !value || value.vars.size > 0) return null
    env[m[1]] = value.fn(0)
  }
  if (![...given.vars].every((name) => name in env)) return null

  const a = given.at(env)
  if (!Number.isFinite(a)) return null
  const b = constant(
    finalPart(answer, (first) => {
      const restated = parseNum(first)
      return Boolean(restated) && [...restated!.vars].every((name) => name in env) && holds('=', restated!.at(env), a)
    }),
  )
  if (b === null) return null
  return holds('=', a, b) ? { ok: true } : { ok: false, note: `Пересчёт даёт ${show(a)}, а в ключе ${show(b)}.` }
}

// Числа, которые удобно подставить руками; длина — простое число, чтобы у разных переменных значения не совпадали
const HANDY = [2, 3, 5, -2, 7, -3, 4, -5, 1.5, -1.5, 0.5, 6, -7]

/**
 * «Упрости», «разложи на множители», «раскрой скобки»: ответ должен быть равен
 * исходному выражению при любых значениях букв. Доведено ли преобразование
 * до конца, подстановка не видит — только что оно ничего не испортило.
 */
function checkIdentity(expression: string, answer: string): MathVerdict | null {
  const given = parseNum(expression)
  if (!given || given.vars.size === 0) return null
  const names = [...given.vars].sort()

  /** Точка, где выражения расходятся; null — равны везде; undefined — сравнить не удалось. */
  const differs = (src: string) => {
    const own = parseNum(src)
    if (!own || ![...own.vars].every((name) => given.vars.has(name))) return undefined
    let compared = 0
    for (let k = 0; k < HANDY.length; k++) {
      const env: Env = {}
      names.forEach((name, j) => (env[name] = HANDY[(k + 2 * j + k * j) % HANDY.length]))
      const a = given.at(env)
      const b = own.at(env)
      // Точка вне области определения — например, знаменатель обратился в ноль
      if (!Number.isFinite(a) || !Number.isFinite(b)) continue
      compared++
      if (!holds('=', a, b)) return { env, a, b }
    }
    return compared >= 5 ? null : undefined
  }

  const final = finalPart(answer, (first) => differs(first) === null)
  const diff = final === null ? undefined : differs(final)
  if (diff === undefined) return null
  if (diff === null) return { ok: true }
  const at = names.map((name) => `${name} = ${show(diff.env[name])}`).join(', ')
  return { ok: false, note: `Подстановка: при ${at} выражение равно ${show(diff.a)}, а ответ — ${show(diff.b)}.` }
}

/** Значения переменных из ответа: «x = 3, y = 2», «x = 3 и y = 2», «(3; 2)». */
function parsePoint(answer: string, vars: string[]): Env | null {
  const text = answer.replace(/[₀-₉]/g, '').trim()
  const pair = /^\(([^;()]+);([^;()]+)\)$/.exec(text)
  const parts = pair ? vars.map((name, i) => `${name} = ${pair[i + 1]}`) : text.split(/\s*[;,]\s+|\s+и\s+/)
  const env: Env = {}
  for (const part of parts) {
    const m = /^([a-zA-Z])\s*=\s*(.+)$/.exec(part.trim())
    const value = m ? parseNum(m[2]) : null
    if (!m || !value || value.vars.size > 0 || !vars.includes(m[1]) || m[1] in env) return null
    env[m[1]] = value.fn(0)
  }
  return vars.every((name) => Number.isFinite(env[name])) ? env : null
}

/**
 * Система двух уравнений с двумя переменными: подставляем ответ в каждое.
 * Не подошёл — пометка. Подошёл — ключ подтверждён только для линейной системы
 * с одним решением: у остальных решений может быть несколько, а подстановка
 * видит лишь то, что названо в ключе.
 */
function checkSystem(rels: Rel[], vars: string[], answer: string): MathVerdict | null {
  if (rels.length !== 2 || !rels.every((r) => r.ops.length === 1 && r.ops[0] === '=')) return null
  const point = parsePoint(answer, vars)
  if (!point) return null

  const failed = rels.findIndex((r) => !r.at(point))
  if (failed !== -1) {
    const at = vars.map((name) => `${name} = ${show(point[name])}`).join(', ')
    return { ok: false, note: `Подстановка: ${at} не подходит к ${failed === 0 ? 'первому' : 'второму'} уравнению.` }
  }

  const [x, y] = vars
  const f = (r: Rel, a: number, b: number) => r.diffAt({ [x]: a, [y]: b })
  const linear = rels.every((r) =>
    [
      [2, 3, 5, -7],
      [-1.5, 4, 0.5, 6],
    ].every(([a, b, c, d]) => holds('=', f(r, a, b) + f(r, c, d), f(r, a + c, b + d) + f(r, 0, 0))),
  )
  if (!linear) return null
  const coef = rels.map((r) => [f(r, 1, 0) - f(r, 0, 0), f(r, 0, 1) - f(r, 0, 0)])
  const det = coef[0][0] * coef[1][1] - coef[0][1] * coef[1][0]
  return Math.abs(det) > 1e-9 ? { ok: true } : null
}

// ─── Вопросы о корнях ───

interface RootQuestion {
  kind: 'max' | 'min' | 'sum' | 'squares' | 'product' | 'count'
  /** Речь о целых решениях. */
  whole: boolean
}

/** О чём спрашивают, кроме «реши»; null — ни о чём; 'unclear' — вопрос составной, не угадываем. */
function aboutRoots(words: string[]): RootQuestion | 'unclear' | null {
  const has = (re: RegExp) => words.some((w) => re.test(w))
  const kinds: RootQuestion['kind'][] = []
  if (has(/^наибольш|^больш(?:ий|ее|его)$/)) kinds.push('max')
  if (has(/^наименьш|^меньш(?:ий|ее|его)$/)) kinds.push('min')
  if (has(/^сумм/)) kinds.push(has(/^квадрат/) ? 'squares' : 'sum')
  if (has(/^произведени/)) kinds.push('product')
  if (has(/^(?:сколько|количество)$/)) kinds.push('count')
  const whole = has(/^цел/)
  if (kinds.length === 0) return whole || has(/^квадрат/) ? 'unclear' : null
  if (kinds.length > 1 || (has(/^квадрат/) && kinds[0] !== 'squares')) return 'unclear'
  return { kind: kinds[0], whole }
}

const WHOLE_REACH = 2000

/** Корни уравнения или целые решения неравенства; null — их бесконечно много или вопрос не про то. */
function solutions(given: Side, equation: boolean, whole: boolean): number[] | null {
  if (!equation) {
    if (!whole || given.cond(-WHOLE_REACH) || given.cond(WHOLE_REACH)) return null
    const out: number[] = []
    for (let n = -WHOLE_REACH; n <= WHOLE_REACH; n++) if (given.cond(n)) out.push(n)
    return out
  }
  // Мелкая сетка рядом с нулём и крупная вдали: корни 0,3 и 0,4 не слипнутся, а 5000 не потеряется
  const found = given.diffs
    .flatMap((f) => [...roots(f, 100), ...roots(f, 1e4), ...roots(f, 1e6)])
    .filter((x) => given.cond(x) && (!whole || Number.isInteger(x)))
    .sort((a, b) => a - b)
  const distinct = found.filter((x, i) => i === 0 || Math.abs(x - found[i - 1]) > 1e-6 * (1 + Math.abs(x)))
  return distinct.length > 20 ? null : distinct
}

function checkRoots(given: Side, equation: boolean, question: RootQuestion, answer: string): MathVerdict | null {
  const found = solutions(given, equation, question.whole)
  // Число само по себе или «x = 4»; цепочка равенств здесь — шаг решения, а не ответ
  const bare = answer.replace(/^[a-zA-Z][₀-₉]?\s*=\s*/, '')
  const key = bare.includes('=') ? null : constant(finalPart(bare, () => false))
  if (!found || key === null) return null
  // «Наибольший корень» уравнения без корней — вопрос ни о чём
  if (found.length === 0 && question.kind !== 'count') return null

  const what = equation ? (question.whole ? 'целых корней' : 'корней') : 'целых решений'
  const one = equation ? (question.whole ? 'целый корень' : 'корень') : 'целое решение'
  const big = equation ? 'наибольший' : 'наибольшее'
  const small = equation ? 'наименьший' : 'наименьшее'
  const [label, value] = ((): [string, number] => {
    switch (question.kind) {
      case 'max':
        return [`${big} ${one}`, found[found.length - 1]]
      case 'min':
        return [`${small} ${one}`, found[0]]
      case 'sum':
        return [`сумма ${what}`, found.reduce((a, b) => a + b, 0)]
      case 'squares':
        return [`сумма квадратов ${what}`, found.reduce((a, b) => a + b * b, 0)]
      case 'product':
        return [`произведение ${what}`, found.reduce((a, b) => a * b, 1)]
      default:
        return [`число ${what}`, found.length]
    }
  })()
  return holds('=', value, key) ? { ok: true } : { ok: false, note: `Пересчёт: ${label} — ${show(value)}, а в ключе ${show(key)}.` }
}
