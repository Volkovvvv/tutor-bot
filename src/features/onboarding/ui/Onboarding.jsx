import { useEffect, useState } from 'react'
import { shareText, tg } from '../../../shared/api/telegram.js'
import { cx } from '../../../shared/lib/cx.js'
import {
  BackButton,
  Button,
  Field,
  Group,
  GroupRow,
  Input,
  PageTitle,
  Pill,
  Stack,
  Switch,
} from '../../../shared/ui/index.js'
import { invitePreview, SUBJECTS } from '../model/invitePreview.js'
import s from './Onboarding.module.css'

const FEATURES = [
  ['01', 'Напоминания', 'Бот сам напишет ученику за день и за час до занятия.'],
  ['02', 'Календарь и деньги', 'Расписание по часам и заработок за месяц.'],
  ['03', 'Всё в Telegram', 'Приложение открывается из чата, ученикам ничего ставить не нужно.'],
]

const REMINDERS = [
  ['notifyBeforeHours', 'За 24 часа', 'Первое напоминание накануне', 24],
  ['notifyBeforeMinutes', 'За 1 час', 'Повтор перед началом', 60],
  ['notifyDebtReminder', 'О долге', 'Если урок не оплачен к вечеру', true],
]

const STEPS = 4

/**
 * Знакомство с приложением при первом входе: предметы и имя,
 * напоминания по умолчанию, первый ученик. Каждый шаг сохраняется
 * на сервер перед переходом дальше — закрыв приложение на середине,
 * репетитор продолжит с заполненными полями.
 */
export default function Onboarding({ profile, onSave, onInvite, onNotify }) {
  const [step, setStep] = useState(0)
  const [busy, setBusy] = useState(false)

  const [subjects, setSubjects] = useState(profile.subjects)
  const [name, setName] = useState(profile.displayName ?? profile.telegramName ?? '')
  const [price, setPrice] = useState(profile.defaultPrice ? String(profile.defaultPrice) : '')
  const [reminders, setReminders] = useState({
    notifyBeforeHours: profile.notifyBeforeHours > 0,
    notifyBeforeMinutes: profile.notifyBeforeMinutes > 0,
    notifyDebtReminder: profile.notifyDebtReminder,
  })
  const [studentName, setStudentName] = useState('')

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [step])

  // Аппаратная «назад» Telegram листает шаги онбординга
  useEffect(() => {
    const bb = tg?.BackButton
    if (!bb) return
    if (step === 0) {
      bb.hide()
      return
    }
    const back = () => setStep((n) => n - 1)
    bb.onClick(back)
    bb.show()
    return () => {
      bb.offClick(back)
      bb.hide()
    }
  }, [step])

  // Сохраняет шаг и переходит дальше; при ошибке остаёмся на месте
  const save = async (patch, next) => {
    setBusy(true)
    const ok = await onSave(patch)
    setBusy(false)
    if (ok && next !== undefined) setStep(next)
    return ok
  }

  const toggleSubject = (subject) =>
    setSubjects((list) => (list.includes(subject) ? list.filter((x) => x !== subject) : [...list, subject]))

  const profileValid = name.trim().length > 0 && Number(price) > 0
  const finish = () => save({ onboarded: true })

  const invite = async () => {
    setBusy(true)
    const result = await onInvite({ name: studentName.trim(), price: Number(price) })
    if (!result) {
      setBusy(false)
      return
    }
    const shared = shareText(result.message)
    onNotify(shared === 'copied' ? 'Приглашение скопировано — отправьте его ученику' : 'Выберите чат ученика')
    await finish()
    setBusy(false)
  }

  const primary = [
    { label: 'Начать', onClick: () => setStep(1), disabled: false },
    {
      label: 'Дальше',
      disabled: !profileValid,
      onClick: () =>
        save({ displayName: name.trim(), subjects, defaultPrice: Number(price) }, 2),
    },
    {
      label: 'Дальше',
      disabled: false,
      onClick: () =>
        save(
          {
            notifyBeforeHours: reminders.notifyBeforeHours ? 24 : 0,
            notifyBeforeMinutes: reminders.notifyBeforeMinutes ? 60 : 0,
            notifyDebtReminder: reminders.notifyDebtReminder,
          },
          3
        ),
    },
    { label: 'Пригласить', disabled: !studentName.trim(), onClick: invite },
  ][step]

  return (
    <div className={s.flow}>
      <div className={s.progress} aria-label={`Шаг ${step + 1} из ${STEPS}`}>
        {Array.from({ length: STEPS }, (_, i) => (
          <span key={i} className={cx(s.bar, i <= step && s.barOn)} />
        ))}
      </div>

      {step > 0 && !tg?.BackButton ? <BackButton onClick={() => setStep(step - 1)} /> : null}

      {step === 0 ? (
        <>
          <Stack gap={14}>
            <Pill>Для репетиторов</Pill>
            <h1 className={s.hero}>Ваш кабинет репетитора в Telegram</h1>
            <p className={s.lead}>Ученики, расписание и деньги в одном месте. Бот сам напоминает о занятиях.</p>
          </Stack>
          <Stack>
            {FEATURES.map(([n, title, text]) => (
              <div key={n} className={s.feature}>
                <span className={s.featureNum}>{n}</span>
                <div>
                  <div className={s.featureTitle}>{title}</div>
                  <div className={s.featureText}>{text}</div>
                </div>
              </div>
            ))}
          </Stack>
        </>
      ) : null}

      {step === 1 ? (
        <>
          <Stack gap={8}>
            <PageTitle>Что вы преподаёте?</PageTitle>
            <p className={s.text}>Предметы попадут в приглашения ученикам.</p>
          </Stack>
          <div className={s.chips}>
            {SUBJECTS.map((subject) => (
              <button
                key={subject}
                type="button"
                aria-pressed={subjects.includes(subject)}
                className={cx(s.chip, subjects.includes(subject) && s.chipOn)}
                onClick={() => toggleSubject(subject)}
              >
                {subject}
              </button>
            ))}
          </div>
          <Field label="Как вас зовут ученики">
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Анна Сергеевна" />
          </Field>
          <Field label="Цена занятия, ₽">
            <Input
              inputMode="numeric"
              value={price}
              onChange={(e) => setPrice(e.target.value.replace(/\D/g, ''))}
              placeholder="1500"
            />
          </Field>
        </>
      ) : null}

      {step === 2 ? (
        <>
          <Stack gap={8}>
            <PageTitle>Напоминания</PageTitle>
            <p className={s.text}>Так бот будет писать новым ученикам. Для каждого можно поменять отдельно.</p>
          </Stack>
          <Group>
            {REMINDERS.map(([key, title, hint]) => (
              <GroupRow
                key={key}
                title={title}
                subtitle={hint}
                trailing={
                  <Switch
                    checked={reminders[key]}
                    label={title}
                    onChange={(on) => setReminders((r) => ({ ...r, [key]: on }))}
                  />
                }
              />
            ))}
          </Group>
          <div className={s.glass}>
            Бот не может написать первым. Ученик один раз откроет вашу ссылку и нажмёт «Начать»,
            после этого напоминания пойдут сами.
          </div>
        </>
      ) : null}

      {step === 3 ? (
        <>
          <Stack gap={8}>
            <PageTitle>Пригласите первого ученика</PageTitle>
            <p className={s.text}>Так ученик увидит приглашение в Telegram.</p>
          </Stack>
          <div className={s.chat}>
            <div className={s.bubble}>
              <div className={s.bubbleFrom}>Бот-помощник</div>
              <div className={s.bubbleText}>
                {invitePreview({ studentName: studentName.trim(), tutorName: name.trim(), subjects })}
              </div>
            </div>
            <div className={s.startButton}>Начать</div>
          </div>
          <Field label="Имя ученика">
            <Input
              value={studentName}
              onChange={(e) => setStudentName(e.target.value)}
              placeholder="Например, Аня Петрова"
            />
          </Field>
        </>
      ) : null}

      <div className={s.actions}>
        <Button onClick={primary.onClick} disabled={primary.disabled || busy}>
          {busy ? 'Сохраняем…' : primary.label}
        </Button>
        {step === 3 ? (
          <Button variant="secondary" onClick={finish} disabled={busy}>
            Сделаю позже
          </Button>
        ) : null}
      </div>
    </div>
  )
}
