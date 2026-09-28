import { monthSummary } from '../../../entities/lesson/index.js'
import { monthName } from '../../../shared/lib/date.js'
import { formatMoney, lessonsWord } from '../../../shared/lib/format.js'
import { HeroCard, Pill } from '../../../shared/ui/index.js'
import s from './MonthSummary.module.css'

/**
 * Главный блок экрана «Деньги»: сколько заработано за месяц.
 *
 * Заработок — крупной цифрой, остальное мельче рядом: репетитор
 * открывает этот экран в первую очередь ради этого числа.
 */
export default function MonthSummary({ lessons, students }) {
  const { doneCount, earned, owed } = monthSummary(lessons, students)

  return (
    <HeroCard>
      <div>
        <Pill>заработано за {monthName()}</Pill>
        <div className={s.amount}>{formatMoney(earned)}</div>
      </div>

      <div className={s.stats}>
        <div className={s.stat}>
          <div className={s.statValue}>{doneCount}</div>
          <div className={s.statLabel}>{lessonsWord(doneCount)} провели</div>
        </div>
        <div className={s.stat}>
          <div className={s.statValue}>{formatMoney(owed)}</div>
          <div className={s.statLabel}>ждём оплаты</div>
        </div>
      </div>
    </HeroCard>
  )
}
