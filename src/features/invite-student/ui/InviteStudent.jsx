import { INVITE_LABELS, INVITE_STATUS } from '../../../entities/student/index.js'
import { copyText, openChat, shareText } from '../../../shared/api/telegram.js'

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
    <>
      <div className="section-title">Приглашение</div>

      <div className={`invite-status invite-${status}`}>
        <span className="invite-dot" />
        {INVITE_LABELS[status]}
      </div>

      {status === INVITE_STATUS.accepted ? (
        <div className="note">
          Ученик подключён — бот сможет присылать ему напоминания.
        </div>
      ) : (
        <>
          <div className="actions">
            <button className="btn" onClick={invite}>
              {status === INVITE_STATUS.invited ? 'Отправить ещё раз' : 'Пригласить в бота'}
            </button>
            {inviteLink ? (
              <button className="btn btn-secondary" onClick={copyLink}>
                Скопировать ссылку
              </button>
            ) : null}
            {student.username ? (
              <button
                className="btn btn-secondary"
                onClick={() => {
                  openChat(student)
                  onNotify('Открываем чат…')
                }}
              >
                Открыть чат
              </button>
            ) : null}
          </div>

          {inviteLink ? <div className="invite-link">{inviteLink}</div> : null}

          <div className="note">
            Ученик должен открыть ссылку и нажать «Начать» — только после
            этого бот сможет ему писать.
          </div>
        </>
      )}
    </>
  )
}
