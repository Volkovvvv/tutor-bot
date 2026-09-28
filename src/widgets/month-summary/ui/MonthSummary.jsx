import { monthSummary } from '../../../entities/lesson/index.js'
import { monthTitle } from '../../../shared/lib/date.js'
import { formatMoney, lessonsWord } from '../../../shared/lib/format.js'
import { Pill } from '../../../shared/ui/index.js'
import s from './MonthSummary.module.css'

/**
 * Главный блок экрана занятий: сколько заработано за месяц.
 *
 * Заработок — крупной цифрой, остальное мельче рядом: репетитор
 * открывает приложение в первую очередь ради этого числа.
 */
export default function MonthSummary({ lessons, students }) {
  const { doneCount, earned, owed } = monthSummary(lessons, students)

  return (
    <div className={s.hero}>
      <Pill>заработано за {monthTitle()}</Pill>
      <div className={s.amount}>{formatMoney(earned)}</div>

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
    </div>
  )
}
