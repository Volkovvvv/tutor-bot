import { INVITE_LABELS, INVITE_STATUS } from '../../../entities/student/index.js'
import { copyText, openChat, shareText } from '../../../shared/api/telegram.js'
import { cx } from '../../../shared/lib/cx.js'
import { Button, Card, Note, Section } from '../../../shared/ui/index.js'
import s from './InviteStudent.module.css'

// Приглашение ученика к боту. Бот сможет писать ему только после того,
// как ученик сам нажмёт «Начать» — Telegram не разрешает писать первым.
// Код и ссылку теперь генерирует сервер (POST /students/:id/invite),
// поэтому приглашение асинхронное — кнопка недоступна на время запроса.
export default function InviteStudent({ student, onInvite, onNotify, inviteLink }) {
  const status = student.inviteStatus ?? INVITE_STATUS.none

  const invite = async () => {
    const result = await onInvite(student.id)
    if (!result) return // ошибка уже показана через reportError в useStore
    const shared = shareText(result.message)
    if (shared === 'shared') onNotify('Выберите чат ученика')
    else if (shared === 'copied') onNotify('Приглашение скопировано')
    else onNotify('Не удалось подготовить приглашение')
  }

  const copyLink = () => {
    if (!inviteLink) return
    onNotify(copyText(inviteLink) ? 'Ссылка скопирована' : 'Не удалось скопировать')
  }

  return (
    <Section title="Приглашение">
      <Card className={cx(s.status, s[status])}>
        <span className={s.dot} />
        {INVITE_LABELS[status]}
      </Card>

      {status === INVITE_STATUS.accepted ? (
        <Note>Ученик подключён — бот сможет присылать ему напоминания.</Note>
      ) : (
        <>
          <Button onClick={invite}>
            {status === INVITE_STATUS.invited ? 'Отправить ещё раз' : 'Пригласить в бота'}
          </Button>
          {inviteLink ? (
            <Button variant="secondary" onClick={copyLink}>
              Скопировать ссылку
            </Button>
          ) : null}
          {student.username ? (
            <Button
              variant="secondary"
              onClick={() => {
                openChat(student)
                onNotify('Открываем чат…')
              }}
            >
              Открыть чат
            </Button>
          ) : null}

          {inviteLink ? <div className={s.link}>{inviteLink}</div> : null}

          <Note>
            Ученик должен открыть ссылку и нажать «Начать» — только после
            этого бот сможет ему писать.
          </Note>
        </>
      )}
    </Section>
  )
}
