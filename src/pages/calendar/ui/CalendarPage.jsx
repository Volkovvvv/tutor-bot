import { lessonEnd, lessonPrice, lessonsOn, nextLesson } from '../../../entities/lesson/index.js'
import { indexById } from '../../../entities/student/index.js'
import { addDays, dayTitle, fromMinutes, parseISO, toMinutes, weekOf, weekdayShort } from '../../../shared/lib/date.js'
import { cx } from '../../../shared/lib/cx.js'
import { formatMoney, pluralLessons } from '../../../shared/lib/format.js'
import { useNow } from '../../../shared/lib/useNow.js'
import { PageTitle, Screen } from '../../../shared/ui/index.js'
import s from './CalendarPage.module.css'

// Пикселей на час таймлайна
const HOUR = 56
// Рабочие часы по умолчанию; раздвигаются, если занятие выходит за них
const DAY_START = 9
const DAY_END = 21

// «Сентябрь — октябрь 2026» или «Октябрь 2026»
function weekRangeTitle(week) {
  const month = (d) => parseISO(d).toLocaleDateString('ru-RU', { month: 'long' })
  const year = parseISO(week[6]).getFullYear()
  const a = month(week[0])
  const b = month(week[6])
  const title = a === b ? `${a} ${year}` : `${a} — ${b} ${year}`
  return title[0].toUpperCase() + title.slice(1)
}

export default function CalendarPage({ students, lessons, date, onSelectDate, onOpenLesson, onAdd }) {
  const now = useNow()
  const studentById = indexById(students)
  const week = weekOf(date)
  const day = lessonsOn(lessons, date)
  const active = day.filter((l) => l.status !== 'cancelled')
  const sum = active.reduce((acc, l) => acc + lessonPrice(l, studentById.get(l.studentId)), 0)
  const next = date === now.date ? nextLesson(day, now.minutes) : null

  const startHour = Math.min(DAY_START, ...day.map((l) => Math.floor(toMinutes(l.time) / 60)))
  const endHour = Math.max(
    DAY_END,
    ...day.map((l) => Math.ceil((toMinutes(l.time) + (l.duration ?? 60)) / 60))
  )
  const top = (minutes) => ((minutes - startHour * 60) / 60) * HOUR
  const hours = []
  for (let h = startHour; h <= endHour; h += 1) hours.push(h)
  const showNow = date === now.date && now.minutes >= startHour * 60 && now.minutes <= endHour * 60

  // Занятий по дням одним проходом, а не фильтром по всему списку на каждый день недели
  const counts = new Map()
  for (const l of lessons) {
    if (l.status !== 'cancelled') counts.set(l.date, (counts.get(l.date) ?? 0) + 1)
  }

  return (
    <Screen>
      <PageTitle
        subtitle={weekRangeTitle(week)}
        action={
          <button type="button" className={s.add} onClick={onAdd}>
            + Занятие
          </button>
        }
      >
        Календарь
      </PageTitle>

      <div className={s.weekNav}>
        <button type="button" className={s.arrow} aria-label="Предыдущая неделя" onClick={() => onSelectDate(addDays(date, -7))}>
          ‹
        </button>
        <div className={s.week}>
          {week.map((d) => {
            const n = Math.min(counts.get(d) ?? 0, 4)
            return (
              <button
                key={d}
                type="button"
                aria-pressed={d === date}
                className={cx(s.day, d === now.date && s.today, d === date && s.selected)}
                onClick={() => onSelectDate(d)}
              >
                <span className={s.dayWeek}>{weekdayShort(d)}</span>
                <span className={s.dayNum}>{parseISO(d).getDate()}</span>
                <span className={s.dots}>
                  {Array.from({ length: n }, (_, i) => (
                    <span key={i} className={s.dot} />
                  ))}
                </span>
              </button>
            )
          })}
        </div>
        <button type="button" className={s.arrow} aria-label="Следующая неделя" onClick={() => onSelectDate(addDays(date, 7))}>
          ›
        </button>
      </div>

      <div className={s.dayHead}>
        <span className={s.dayTitle}>{dayTitle(date)}</span>
        {active.length ? (
          <span className={s.daySummary}>
            {pluralLessons(active.length)} · {formatMoney(sum)}
          </span>
        ) : null}
      </div>

      <div className={s.timelineCard}>
        <div className={s.timeline} style={{ height: (endHour - startHour) * HOUR + 8 }}>
          {hours.map((h) => (
            <div key={h} className={s.hour} style={{ top: (h - startHour) * HOUR }}>
              <span className={s.hourLabel}>{fromMinutes(h * 60)}</span>
              <span className={s.hourLine} />
            </div>
          ))}

          {day.map((l) => {
            const st = studentById.get(l.studentId)
            const start = toMinutes(l.time)
            return (
              <button
                key={l.id}
                type="button"
                className={cx(
                  s.block,
                  l.id === next?.id && s.blockNext,
                  l.status === 'done' && s.blockDone,
                  l.status === 'cancelled' && s.blockCancelled
                )}
                style={{ top: top(start) + 2, height: ((l.duration ?? 60) / 60) * HOUR - 4 }}
                onClick={() => onOpenLesson(l.id)}
              >
                <span className={s.blockName}>
                  {st?.name ?? 'Удалённый ученик'}
                  {l.status === 'done' ? <span className={s.check}>✓</span> : null}
                </span>
                <span className={s.blockMeta}>
                  {l.time}–{lessonEnd(l)}
                  {st?.note ? ` · ${st.note}` : ''}
                </span>
              </button>
            )
          })}

          {showNow ? (
            <div className={s.now} style={{ top: top(now.minutes) }}>
              <span className={s.nowDot} />
              <span className={s.nowLabel}>{fromMinutes(now.minutes)}</span>
            </div>
          ) : null}

          {day.length === 0 ? (
            <div className={s.empty}>
              <div className={s.emptyTitle}>Свободный день</div>
              <div className={s.emptyText}>Занятий нет. Можно отдохнуть.</div>
            </div>
          ) : null}
        </div>
      </div>
    </Screen>
  )
}
