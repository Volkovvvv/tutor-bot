import { canNotify } from '../../../entities/student/index.js'
import {
  ChipGroup,
  FieldGroup,
  Input,
  Note,
  Row,
  Section,
  ToggleRow,
} from '../../../shared/ui/index.js'

const BEFORE_HOURS = [
  { value: 0, label: 'Выкл' },
  { value: 2, label: 'За 2 ч' },
  { value: 24, label: 'За сутки' },
  { value: 48, label: 'За 2 дня' },
]

const BEFORE_MINUTES = [
  { value: 0, label: 'Выкл' },
  { value: 30, label: 'За 30 мин' },
  { value: 60, label: 'За час' },
]

// Настройки хранятся у ученика, применять их будет бот.
// Пока бота нет, экран работает как черновик конфигурации.
export default function NotifySettings({ student, onChange }) {
  const notify = student.notify
  if (!notify) return null

  const active = canNotify(student)
  const set = (patch) => onChange(student.id, { ...notify, ...patch })

  return (
    <Section title="Уведомления ученику">
      <ToggleRow
        title="Присылать напоминания"
        hint="Отправляет бот в Telegram"
        checked={notify.enabled}
        onChange={(enabled) => set({ enabled })}
      />

      {notify.enabled ? (
        <>
          <FieldGroup label="Напомнить заранее">
            <ChipGroup
              options={BEFORE_HOURS}
              value={notify.beforeHours}
              onChange={(beforeHours) => set({ beforeHours })}
            />
          </FieldGroup>

          <FieldGroup label="И ещё раз перед занятием">
            <ChipGroup
              options={BEFORE_MINUTES}
              value={notify.beforeMinutes}
              onChange={(beforeMinutes) => set({ beforeMinutes })}
            />
          </FieldGroup>

          <ToggleRow
            title="Напоминать об оплате"
            hint="Если есть прошедшие неоплаченные занятия"
            checked={notify.debtReminder}
            onChange={(debtReminder) => set({ debtReminder })}
          />

          <FieldGroup label="Не беспокоить">
            <Row>
              <Input
                type="time"
                aria-label="С"
                value={notify.quietFrom}
                onChange={(e) => set({ quietFrom: e.target.value })}
              />
              <Input
                type="time"
                aria-label="До"
                value={notify.quietTo}
                onChange={(e) => set({ quietTo: e.target.value })}
              />
            </Row>
          </FieldGroup>
        </>
      ) : null}

      {!active && notify.enabled ? (
        <Note>
          Настройки сохранены, но напоминания начнут приходить только после того,
          как ученик подключится по приглашению.
        </Note>
      ) : null}
    </Section>
  )
}
