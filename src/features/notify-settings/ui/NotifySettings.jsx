import { canNotify } from '../../../entities/student/index.js'

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
    <>
      <div className="section-title">Уведомления ученику</div>

      <div className="switch-row">
        <div>
          <div>Присылать напоминания</div>
          <div className="switch-sub">Отправляет бот в Telegram</div>
        </div>
        <button
          className={`switch ${notify.enabled ? 'on' : ''}`}
          onClick={() => set({ enabled: !notify.enabled })}
          aria-label="Включить напоминания"
          role="switch"
          aria-checked={notify.enabled}
        >
          <span className="switch-knob" />
        </button>
      </div>

      {notify.enabled ? (
        <>
          <div className="field">
            <label>Напомнить заранее</label>
            <div className="chips">
              {BEFORE_HOURS.map((o) => (
                <button
                  key={o.value}
                  className={`chip ${notify.beforeHours === o.value ? 'on' : ''}`}
                  onClick={() => set({ beforeHours: o.value })}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </div>

          <div className="field">
            <label>И ещё раз перед занятием</label>
            <div className="chips">
              {BEFORE_MINUTES.map((o) => (
                <button
                  key={o.value}
                  className={`chip ${notify.beforeMinutes === o.value ? 'on' : ''}`}
                  onClick={() => set({ beforeMinutes: o.value })}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </div>

          <div className="switch-row">
            <div>
              <div>Напоминать об оплате</div>
              <div className="switch-sub">Если есть прошедшие неоплаченные занятия</div>
            </div>
            <button
              className={`switch ${notify.debtReminder ? 'on' : ''}`}
              onClick={() => set({ debtReminder: !notify.debtReminder })}
              role="switch"
              aria-checked={notify.debtReminder}
            >
              <span className="switch-knob" />
            </button>
          </div>

          <div className="field">
            <label>Не беспокоить</label>
            <div className="row-2">
              <input
                type="time"
                value={notify.quietFrom}
                onChange={(e) => set({ quietFrom: e.target.value })}
              />
              <input
                type="time"
                value={notify.quietTo}
                onChange={(e) => set({ quietTo: e.target.value })}
              />
            </div>
          </div>
        </>
      ) : null}

      {!active && notify.enabled ? (
        <div className="note">
          Настройки сохранены, но напоминания начнут приходить только после того,
          как ученик подключится по приглашению.
        </div>
      ) : null}
    </>
  )
}
