import s from './HeroCard.module.css'

// Главная карточка экрана: белая, с крупным полупрозрачным «+» на фоне,
// как на постах. Следующее занятие, заработок за месяц
export default function HeroCard({ children }) {
  return <div className={s.hero}>{children}</div>
}
