// Инициалы вместо фото: аватарки пользователей Mini App недоступны

// Палитра градиентов. Цвет выбирается по имени, а не случайно —
// у одного ученика он всегда одинаковый, и список легче читать глазами.
const PALETTE = [
  ['#6d5efc', '#46b1ff'],
  ['#ff8a3d', '#ff5f8f'],
  ['#11998e', '#38ef7d'],
  ['#f857a6', '#ff5858'],
  ['#4776e6', '#8e54e9'],
  ['#f2994a', '#f2c94c'],
  ['#00b4db', '#0083b0'],
  ['#c94b4b', '#4b134f'],
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
