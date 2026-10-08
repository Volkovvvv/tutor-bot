import { monthByStudent } from '../../../entities/lesson/index.js'
import { formatMoney, pluralLessons } from '../../../shared/lib/format.js'
import { EmptyState, Group, GroupRow, PageTitle, Screen, Section } from '../../../shared/ui/index.js'
import { MonthSummary } from '../../../widgets/month-summary/index.js'
import s from './MoneyPage.module.css'

export default function MoneyPage({ students, lessons, onOpenStudent }) {
  // Архивный ученик остаётся в списке, только если в этом месяце у него были занятия
  const rows = monthByStudent(lessons, students).filter((r) => !r.student.archived || r.doneCount > 0)

  return (
    <Screen>
      <PageTitle>Деньги</PageTitle>

      <MonthSummary lessons={lessons} students={students} />

      <Section title="По ученикам">
        {rows.length === 0 ? (
          <EmptyState>Здесь появится заработок по каждому ученику.</EmptyState>
        ) : (
          <Group>
            {rows.map(({ student, doneCount, earned, owed }) => (
              <GroupRow
                key={student.id}
                title={<span className={s.name}>{student.name}</span>}
                subtitle={`${pluralLessons(doneCount)} · ${formatMoney(student.price)}`}
                trailing={
                  <>
                    <span className={s.sum}>{formatMoney(earned)}</span>
                    {owed > 0 ? <span className={s.owed}>долг {formatMoney(owed)}</span> : null}
                  </>
                }
                onClick={() => onOpenStudent(student.id)}
              />
            ))}
          </Group>
        )}
      </Section>
    </Screen>
  )
}
