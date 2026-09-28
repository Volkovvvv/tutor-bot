import { Stack } from '../Layout/Layout.jsx'
import s from './Section.module.css'

// Смысловой блок экрана: мелкий заголовок капсом и содержимое под ним.
// aside — метка рядом с заголовком
export default function Section({ title, aside, children }) {
  return (
    <section>
      <Stack>
        <div className={s.head}>
          <h2 className={s.title}>{title}</h2>
          {aside}
        </div>
        {children}
      </Stack>
    </section>
  )
}
