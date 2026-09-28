import { INVITE_STATUS } from '../../../entities/student/index.js'
import { copyText, shareText } from '../../../shared/api/telegram.js'
import { cx } from '../../../shared/lib/cx.js'
import { Button, Card } from '../../../shared/ui/index.js'
import s from './InviteStudent.module.css'

const COPY = {
  [INVITE_STATUS.none]: {
    title: 'Не подключён к боту',
    text: 'Бот не может написать первым. Отправьте ученику ссылку-приглашение.',
    action: 'Пригласить в бота',
  },
  [INVITE_STATUS.invited]: {
    title: 'Приглашение отправлено',
    text: 'Ждём, когда ученик откроет ссылку и нажмёт «Начать». До этого бот не может ему написать.',
    action: 'Отправить ссылку ещё раз',
  },
  [INVITE_STATUS.accepted]: {
    title: 'Подключён к боту',
    text: 'Напоминания и сообщения уходят ученику в личку от бота.',
    action: null,
  },
}

// Карточка статуса ученика в боте. Бот сможет писать ему только после того,
// как ученик сам нажмёт «Начать» — Telegram не разрешает писать первым.
// Код и ссылку генерирует сервер (POST /students/:id/invite),
// поэтому приглашение асинхронное.
export default function InviteStudent({ student, onInvite, onNotify, inviteLink }) {
  const status = student.inviteStatus ?? INVITE_STATUS.none
  const copy = COPY[status]

  const invite = async () => {
    const result = await onInvite(student.id)
    if (!result) return // ошибка уже показана через reportError в useStore
    const shared = shareText(result.message)
    if (shared === 'shared') onNotify('Выберите чат ученика')
    else if (shared === 'copied') onNotify('Приглашение скопировано')
    else onNotify('Не удалось подготовить приглашение')
  }

  const copyLink = () => {
    onNotify(copyText(inviteLink) ? 'Ссылка скопирована' : 'Не удалось скопировать')
  }

  return (
    <Card className={s.card}>
      <div className={s.head}>
        <span className={cx(s.dot, s[status])} />
        <span className={s.title}>{copy.title}</span>
      </div>
      <span className={s.text}>{copy.text}</span>

      {inviteLink && status !== INVITE_STATUS.accepted ? (
        <button type="button" className={s.link} onClick={copyLink}>
          <span className={s.linkText}>{inviteLink.replace(/^https?:\/\//, '')}</span>
          <span className={s.linkAction}>копировать</span>
        </button>
      ) : null}

      {copy.action ? (
        <Button className={s.action} onClick={invite}>
          {copy.action}
        </Button>
      ) : null}
    </Card>
  )
}
