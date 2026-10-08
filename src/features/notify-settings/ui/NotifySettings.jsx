import { INVITE_STATUS } from '../../../entities/student/index.js'
import { Group, GroupRow, Section, Switch } from '../../../shared/ui/index.js'
import s from './NotifySettings.module.css'

// Переключатели → поля настроек на сервере. «Выключено» — это 0:
// так планировщик уже понимает beforeHours/beforeMinutes
const ROWS = [
  {
    title: 'За 24 часа',
    hint: 'Первое напоминание накануне',
    on: (n) => n.beforeHours > 0,
    patch: (on) => ({ beforeHours: on ? 24 : 0 }),
  },
  {
    title: 'За 1 час',
    hint: 'Повтор перед началом',
    on: (n) => n.beforeMinutes > 0,
    patch: (on) => ({ beforeMinutes: on ? 60 : 0 }),
  },
]

// Настройки хранятся у ученика, применяет их бот. Пока ученик
// не подключился, блок приглушён — настройки заработают после «Начать»
export default function NotifySettings({ student, onChange }) {
  const notify = student.notify
  if (!notify) return null

  const connected = student.inviteStatus === INVITE_STATUS.accepted
  // Выключенный общий флаг показываем как «всё выключено»
  const isOn = (row) => notify.enabled && row.on(notify)

  const set = (patch) => {
    const next = { ...notify, ...patch }
    // Общий флаг включён, пока включено хоть одно напоминание
    next.enabled = ROWS.some((row) => row.on(next))
    onChange(student.id, next)
  }

  const toggle = (row, on) => {
    // Включая один пункт после общего «выкл», остальные тоже гасим явно
    const base = notify.enabled ? {} : Object.assign({}, ...ROWS.map((r) => r.patch(false)))
    set({ ...base, ...row.patch(on) })
  }

  return (
    <Section title="Напоминания через бота">
      <div className={connected ? undefined : s.dimmed}>
        <Group>
          {ROWS.map((row) => (
            <GroupRow
              key={row.title}
              title={row.title}
              subtitle={row.hint}
              trailing={<Switch checked={isOn(row)} onChange={(on) => toggle(row, on)} label={row.title} />}
            />
          ))}
          <GroupRow
            title="Тихие часы"
            subtitle="Ночью бот молчит"
            trailing={
              <div className={s.quiet}>
                <input
                  type="time"
                  aria-label="Тихие часы с"
                  value={notify.quietFrom}
                  onChange={(e) => set({ quietFrom: e.target.value })}
                />
                –
                <input
                  type="time"
                  aria-label="Тихие часы до"
                  value={notify.quietTo}
                  onChange={(e) => set({ quietTo: e.target.value })}
                />
              </div>
            }
          />
        </Group>
      </div>
    </Section>
  )
}
