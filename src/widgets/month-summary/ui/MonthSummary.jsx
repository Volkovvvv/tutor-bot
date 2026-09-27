import { monthSummary } from '../../../entities/lesson/index.js'
import { monthTitle } from '../../../shared/lib/date.js'
import { formatMoney } from '../../../shared/lib/format.js'

export default function MonthSummary({ lessons, students }) {
  const { doneCount, earned, owed } = monthSummary(lessons, students)

  return (
    <div className="summary">
      <h2>Итоги за {monthTitle()}</h2>
      <div className="summary-row"><span>Проведено занятий</span><b>{doneCount}</b></div>
      <div className="summary-row"><span>Заработано</span><b>{formatMoney(earned)}</b></div>
      <div className="summary-row"><span>Должны</span><b>{formatMoney(owed)}</b></div>
    </div>
  )
}
