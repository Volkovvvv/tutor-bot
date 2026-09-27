// Инициалы вместо фото: аватарки пользователей Mini App недоступны

// Палитра градиентов в тонах фирменной пары: от тёплых коричневых
// до приглушённых сине-зелёных. Цвет выбирается по имени, а не случайно —
// у одного ученика он всегда одинаковый, и список легче читать глазами.
// Все оттенки достаточно тёмные, чтобы белые инициалы читались поверх них.
const PALETTE = [
  ['#4D291D', '#7A4632'],
  ['#6B3A23', '#935534'],
  ['#2B5F85', '#3F7FA6'],
  ['#3D5A6C', '#567689'],
  ['#5C4033', '#7D5740'],
  ['#1A6A43', '#2E8659'],
  ['#7A4632', '#9A6947'],
  ['#35566B', '#4A7189'],
]

function gradientFor(name) {
  let hash = 0
  for (let i = 0; i < name.length; i += 1) {
    hash = (hash * 31 + name.charCodeAt(i)) | 0
  }
  const [from, to] = PALETTE[Math.abs(hash) % PALETTE.length]
  return `linear-gradient(135deg, ${from}, ${to})`
}

export default function Avatar({ name }) {
  const initials = name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('')

  return (
    <div className="avatar" style={{ background: gradientFor(name) }}>
      {initials || '?'}
    </div>
  )
}
