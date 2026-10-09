import { monthByStudent } from '../../../entities/lesson/index.js'
import { formatMoney, pluralLessons } from '../../../shared/lib/format.js'
import { EmptyState, Group, GroupRow, PageTitle, Screen, Section, Segmented } from '../../../shared/ui/index.js'
import { MonthSummary } from '../../../widgets/month-summary/index.js'
import s from './MoneyPage.module.css'

// Валюта идёт за страной в профиле: та же настройка, что в онбординге
const CURRENCY_OPTIONS = [
  { value: 'RU', label: 'Россия · ₽' },
  { value: 'BY', label: 'Беларусь · BYN' },
]

export default function MoneyPage({ students, lessons, country, onSetCountry, onOpenStudent }) {
  const rows = monthByStudent(lessons, students)

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

      <Section title="Валюта">
        <Segmented label="Страна и валюта" options={CURRENCY_OPTIONS} value={country} onChange={onSetCountry} />
      </Section>
    </Screen>
  )
}
