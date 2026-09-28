import Pill from '../Pill/Pill.jsx'
import { Stack } from '../Layout/Layout.jsx'
import s from './Section.module.css'

// Смысловой блок экрана: лаймовая метка-заголовок и содержимое под ней
export default function Section({ title, children }) {
  return (
    <section className={s.section}>
      <Stack>
        <Pill as="h2">{title}</Pill>
        {children}
      </Stack>
    </section>
  )
}
