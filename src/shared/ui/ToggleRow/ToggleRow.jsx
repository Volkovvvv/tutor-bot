import Card from '../Card/Card.jsx'
import Switch from '../Switch/Switch.jsx'
import s from './ToggleRow.module.css'

// Настройка «вкл/выкл» на карточке: название, пояснение, переключатель
export default function ToggleRow({ title, hint, checked, onChange }) {
  return (
    <Card>
      <div className={s.row}>
        <div>
          <div>{title}</div>
          {hint ? <div className={s.hint}>{hint}</div> : null}
        </div>
        <Switch checked={checked} onChange={onChange} label={title} />
      </div>
    </Card>
  )
}
