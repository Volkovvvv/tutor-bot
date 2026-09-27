// Инициалы вместо фото: аватарки пользователей Mini App недоступны
export default function Avatar({ name }) {
  const initials = name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('')
  return <div className="avatar">{initials || '?'}</div>
}
