import { INVITE_LABELS, INVITE_STATUS } from '../../../entities/student/index.js'
import { BOT_CONFIGURED } from '../../../shared/config/bot.js'
import { copyText, openChat, shareText } from '../../../shared/api/telegram.js'
import { inviteLink, inviteMessage } from '../model/invite.js'

// Приглашение ученика к боту. Бот сможет писать ему только после того,
// как ученик сам нажмёт «Начать» — Telegram не разрешает писать первым.
export default function InviteStudent({ student, onInvite, onMarkAccepted, onNotify }) {
  const status = student.inviteStatus ?? INVITE_STATUS.none
  const code = student.inviteCode

  const invite = () => {
    // Код создаём один раз и переиспользуем, чтобы старая ссылка не протухла
    const nextCode = code ?? onInvite(student.id)
    const text = inviteMessage(student, nextCode)
    const result = shareText(text)
    if (result === 'shared') onNotify('Выберите чат ученика')
    else if (result === 'copied') onNotify('Приглашение скопировано')
    else onNotify('Не удалось подготовить приглашение')
  }

  const copyLink = () => {
    if (!code) return
    onNotify(copyText(inviteLink(code)) ? 'Ссылка скопирована' : 'Не удалось скопировать')
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
            {code ? (
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

          {code ? <div className="invite-link">{inviteLink(code)}</div> : null}

          <div className="note">
            {BOT_CONFIGURED
              ? 'Ученик должен открыть ссылку и нажать «Начать» — только после этого бот сможет ему писать.'
              : 'Бот ещё не подключён: в ссылке стоит заглушка. Укажите VITE_BOT_USERNAME при сборке, когда бот будет создан.'}
          </div>

          {status === INVITE_STATUS.invited ? (
            <button className="link-btn" onClick={() => onMarkAccepted(student.id)}>
              Ученик уже подтвердил — отметить вручную
            </button>
          ) : null}
        </>
      )}
    </>
  )
}
