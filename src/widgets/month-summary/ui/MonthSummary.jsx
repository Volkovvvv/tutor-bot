import { monthSummary } from '../../../entities/lesson/index.js'
import { monthTitle } from '../../../shared/lib/date.js'
import { formatMoney, lessonsWord } from '../../../shared/lib/format.js'

/**
 * Главный блок экрана занятий: сколько заработано за месяц.
 *
 * Заработок — крупной цифрой, остальное мельче рядом: репетитор
 * открывает приложение в первую очередь ради этого числа.
 */
export default function MonthSummary({ lessons, students }) {
  const { doneCount, earned, owed } = monthSummary(lessons, students)

  return (
    <div className="hero">
      <div className="hero-label">заработано за {monthTitle()}</div>
      <div className="hero-amount">{formatMoney(earned)}</div>

      <div className="hero-stats">
        <div className="hero-stat">
          <div className="hero-stat-value">{doneCount}</div>
          <div className="hero-stat-label">{lessonsWord(doneCount)} провели</div>
        </div>
        <div className="hero-stat">
          <div className="hero-stat-value">{formatMoney(owed)}</div>
          <div className="hero-stat-label">ждём оплаты</div>
        </div>
      </div>
    </div>
  )
}
