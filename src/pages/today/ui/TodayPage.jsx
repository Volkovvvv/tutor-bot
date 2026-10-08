import { lessonEnd, lessonPrice, lessonsOn, LessonRow, nextLesson } from '../../../entities/lesson/index.js'
import { canNotify, indexById, INVITE_STATUS } from '../../../entities/student/index.js'
import { dayTitle, toMinutes } from '../../../shared/lib/date.js'
import { formatMoney, lessonsWord } from '../../../shared/lib/format.js'
import { useNow } from '../../../shared/lib/useNow.js'
import { Button, EmptyState, HeroCard, PageTitle, Pill, Screen, Section, Stack } from '../../../shared/ui/index.js'
import s from './TodayPage.module.css'

function nextPill(lesson, now) {
  const diff = toMinutes(lesson.time) - now
  if (diff <= 0) return 'Идёт сейчас'
  if (diff < 60) return `Следующее · через ${diff} мин`
  return `Следующее · в ${lesson.time}`
}

// Что бот сделает с напоминанием по этому ученику
function botLine(student) {
  if (student.inviteStatus !== INVITE_STATUS.accepted) {
    return { ok: false, text: 'Ученик не подключён к боту, напомните сами' }
  }
  if (!canNotify(student)) return { ok: false, text: 'Напоминания для ученика выключены' }
  const parts = [
    student.notify.beforeHours > 0 && 'накануне',
    student.notify.beforeMinutes > 0 && `за ${student.notify.beforeMinutes} мин`,
  ].filter(Boolean)
  return parts.length
    ? { ok: true, text: `Бот напомнит ${parts.join(' и ')} до занятия` }
    : { ok: false, text: 'Напоминания для ученика выключены' }
}

// С чего начать, пока учеников нет
const FIRST_STEPS = [
  'Отправьте ученику ссылку-приглашение.',
  'Он нажмёт «Начать» в боте, и напоминания пойдут сами.',
  'Добавьте занятие в календарь, и оно появится здесь.',
]

export default function TodayPage({ students, lessons, onOpenLesson, onAddLesson, onImportSchedule, onInvite, onAddStudent, onFeedback }) {
  const now = useNow()
  const studentById = indexById(students)
  const today = lessonsOn(lessons, now.date)
  const next = nextLesson(today, now.minutes)
  const active = today.filter((l) => l.status !== 'cancelled')
  const sum = active.reduce((acc, l) => acc + lessonPrice(l, studentById.get(l.studentId)), 0)
  const nextStudent = next ? studentById.get(next.studentId) : null
  const bot = nextStudent ? botLine(nextStudent) : null

  // Без учеников расписание и счётчики пусты и ничего не подсказывают —
  // вместо них один понятный первый шаг
  if (students.length === 0) {
    return (
      <Screen>
        <PageTitle subtitle={dayTitle(now.date)}>Сегодня</PageTitle>
        <div className={s.first}>
          <Pill>Первый шаг</Pill>
          <div className={s.firstTitle}>Добавьте первого ученика</div>
          <div className={s.firstSteps}>
            {FIRST_STEPS.map((text, i) => (
              <div key={text} className={s.firstStep}>
                <span className={s.firstNum}>{i + 1}</span>
                <span>{text}</span>
              </div>
            ))}
          </div>
          <Button onClick={onInvite}>Пригласить ученика</Button>
          <Button className={s.firstManual} variant="secondary" onClick={onAddStudent}>
            + Добавить вручную
          </Button>
          {/* Импорт заводит и учеников, и занятия — тоже годится первым шагом */}
          <Button className={s.firstManual} variant="secondary" onClick={onImportSchedule}>
            Загрузить расписание с фото
          </Button>
        </div>
        <Button className={s.firstManual} variant="secondary" onClick={onFeedback}>
          Написать разработчику
        </Button>
      </Screen>
    )
  }

  return (
    <Screen>
      <PageTitle subtitle={dayTitle(now.date)}>Сегодня</PageTitle>

      {next ? (
        <HeroCard>
          <Pill>{nextPill(next, now.minutes)}</Pill>
          <div>
            <div className={s.nextName}>{nextStudent?.name ?? 'Удалённый ученик'}</div>
            <div className={s.nextMeta}>
              {next.time}–{lessonEnd(next)}
              {nextStudent?.note ? ` · ${nextStudent.note}` : ''}
            </div>
          </div>
          {bot ? (
            <div className={s.bot}>
              <span className={bot.ok ? s.dotOk : s.dotWarn} />
              <span>{bot.text}</span>
            </div>
          ) : null}
          <Button className={s.open} onClick={() => onOpenLesson(next.id)}>
            Открыть урок
          </Button>
        </HeroCard>
      ) : null}

      <div className={s.stats}>
        <div className={s.stat}>
          <div className={s.statValue}>{active.length}</div>
          <div className={s.statLabel}>{lessonsWord(active.length)} сегодня</div>
        </div>
        <div className={s.stat}>
          <div className={s.statValue}>{formatMoney(sum)}</div>
          <div className={s.statLabel}>за день</div>
        </div>
      </div>

      <Section title="Расписание дня">
        {today.length === 0 ? (
          <EmptyState icon="☕" title="Свободный день">
            Занятий сегодня нет. Можно отдохнуть или запланировать новое.
          </EmptyState>
        ) : (
          <Stack>
            {today.map((l) => {
              const st = studentById.get(l.studentId)
              return (
                <LessonRow
                  key={l.id}
                  lesson={l}
                  isNext={next?.id === l.id}
                  title={st?.name ?? 'Удалённый ученик'}
                  subtitle={`${st?.note ? `${st.note} · ` : ''}до ${lessonEnd(l)}`}
                  onClick={() => onOpenLesson(l.id)}
                />
              )
            })}
          </Stack>
        )}
      </Section>

      {today.length === 0 ? (
        <Button onClick={onAddLesson}>+ Добавить занятие</Button>
      ) : null}

      <Button className={s.firstManual} variant="secondary" onClick={onFeedback}>
        Написать разработчику
      </Button>
    </Screen>
  )
}
