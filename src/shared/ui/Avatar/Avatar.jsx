import s from './Avatar.module.css'

// Инициалы вместо фото: аватарки пользователей Mini App недоступны

// Пары [фон, цвет букв] в фирменной гамме: лайм, оттенки лаванды
// и тёмный индиго. Цвет выбирается по имени, а не случайно —
// у одного ученика он всегда одинаковый, и список легче читать глазами.
const PALETTE = [
  ['#d8ee7e', '#2b2b1a'],
  ['#8f81cf', '#ffffff'],
  ['#26223a', '#d8ee7e'],
  ['#5a4bb5', '#ffffff'],
  ['#e6e1fa', '#26223a'],
  ['#b3a8e6', '#26223a'],
]

function colorsFor(name) {
  let hash = 0
  for (let i = 0; i < name.length; i += 1) {
    hash = (hash * 31 + name.charCodeAt(i)) | 0
  }
  return PALETTE[Math.abs(hash) % PALETTE.length]
}

export default function Avatar({ name }) {
  const initials = name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('')

  const [background, color] = colorsFor(name)

  return (
    <div className={s.avatar} style={{ background, color }}>
      {initials || '?'}
    </div>
  )
}
