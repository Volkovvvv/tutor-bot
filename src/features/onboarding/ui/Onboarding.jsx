import { useEffect, useRef, useState } from 'react'
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
import { demoMaterial } from '../model/demoMaterial.js'
import { invitePreview, SUBJECTS } from '../model/invitePreview.js'
import s from './Onboarding.module.css'

const FEATURES = [
  ['01', 'Конспект в PDF', 'После урока ИИ соберёт теорию и домашку в фирменный PDF.'],
  ['02', 'Напоминания', 'Бот сам напишет ученику за день и за час до занятия.'],
  ['03', 'Календарь и деньги', 'Расписание переносится с фото, заработок считается сам.'],
]

// Шаг «Расписание с фото»: что произойдёт, по порядку
const IMPORT_PLAN = [
  'Сфотографируйте расписание из блокнота или вставьте его текстом',
  'Проверьте учеников, дни и время — всё можно поправить',
  'Занятия встанут в календарь и будут повторяться каждую неделю',
]

const REMINDERS = [
  ['notifyBeforeHours', 'За 24 часа', 'Первое напоминание накануне', 24],
  ['notifyBeforeMinutes', 'За 1 час', 'Повтор перед началом', 60],
]

const STEPS = 6

// Шаг «Домашка за минуту»: лист собирается на глазах, по разделу за такт.
// Такт 0 — ещё не запускали, 4 — готово; подпись — что «пишется» сейчас.
const DEMO_TICK_MS = 700
const DEMO_DONE = 4
const DEMO_STATUS = ['', 'Пишу теорию…', 'Разбираю пример…', 'Подбираю домашку…', 'Готово']
const DEMO_PLAN = ['Теория по теме', 'Разбор примера', '4 задачи на дом', 'Вёрстка PDF']

/**
 * Знакомство с приложением при первом входе: предметы, пример PDF
 * и подпись на нём, напоминания по умолчанию, расписание с фото, первый ученик. Каждый шаг
 * сохраняется на сервер перед переходом дальше — закрыв приложение
 * на середине, репетитор продолжит с заполненными полями.
 */
export default function Onboarding({ profile, onSave, onInvite, onNotify, onImportSchedule }) {
  const [step, setStep] = useState(0)
  const [busy, setBusy] = useState(false)

  const [subjects, setSubjects] = useState(profile.subjects)
  const [name, setName] = useState(profile.displayName ?? profile.telegramName ?? '')
  const [price, setPrice] = useState(profile.defaultPrice ? String(profile.defaultPrice) : '')
  const [reminders, setReminders] = useState({
    notifyBeforeHours: profile.notifyBeforeHours > 0,
    notifyBeforeMinutes: profile.notifyBeforeMinutes > 0,
  })
  const [studentName, setStudentName] = useState('')
  const [demoTick, setDemoTick] = useState(0)
  const demoTimer = useRef(null)

  const runDemo = () => {
    clearInterval(demoTimer.current)
    setDemoTick(1)
    demoTimer.current = setInterval(() => {
      setDemoTick((tick) => {
        if (tick + 1 >= DEMO_DONE) clearInterval(demoTimer.current)
        return Math.min(tick + 1, DEMO_DONE)
      })
    }, DEMO_TICK_MS)
  }

  // Пример начинает собираться сам, как только репетитор дошёл до шага
  useEffect(() => {
    if (step === 2 && demoTick === 0) runDemo()
    // demoTick не в зависимостях: запускаем по приходу на шаг, а не по тактам
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step])

  useEffect(() => () => clearInterval(demoTimer.current), [])

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

  const finish = (patch) => save({ ...patch, onboarded: true })

  // Подпись сохраняем, только если она есть: пустую сервер не примет,
  // а без неё лист подпишется именем из Telegram
  const leaveDemo = () => {
    clearInterval(demoTimer.current)
    setDemoTick(DEMO_DONE)
    return name.trim() ? save({ displayName: name.trim() }, 3) : setStep(3)
  }

  // Расписание с фото заводит и учеников, и занятия — знакомство на этом
  // заканчивается, а шаг с приглашением остаётся на потом: оно есть в карточке ученика
  const importSchedule = async () => {
    if (await finish()) onImportSchedule()
  }

  const invite = async () => {
    setBusy(true)
    const result = await onInvite({ name: studentName.trim(), price: Number(price) })
    if (!result) {
      setBusy(false)
      return
    }
    const shared = shareText(result.message)
    onNotify(shared === 'copied' ? 'Приглашение скопировано — отправьте его ученику' : 'Выберите чат ученика')
    // Цена первого ученика — цена по умолчанию для следующих
    await finish({ defaultPrice: Number(price) })
    setBusy(false)
  }

  const primary = [
    { label: 'Начать', onClick: () => setStep(1), disabled: false },
    { label: 'Дальше', disabled: false, onClick: () => save({ subjects }, 2) },
    demoTick === 0
      ? { label: 'Сгенерировать', disabled: false, onClick: runDemo }
      : demoTick < DEMO_DONE
        ? { label: 'Генерирую…', disabled: true, onClick: () => {} }
        : { label: 'Дальше', disabled: false, onClick: leaveDemo },
    {
      label: 'Дальше',
      disabled: false,
      onClick: () =>
        save(
          {
            notifyBeforeHours: reminders.notifyBeforeHours ? 24 : 0,
            notifyBeforeMinutes: reminders.notifyBeforeMinutes ? 60 : 0,
            notifyDebtReminder: false,
          },
          4
        ),
    },
    { label: 'Загрузить расписание', disabled: false, onClick: importSchedule },
    { label: 'Пригласить', disabled: !studentName.trim() || !(Number(price) > 0), onClick: invite },
  ][step]

  const demo = demoMaterial(subjects)

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
          <PageTitle>Что вы преподаёте?</PageTitle>
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
        </>
      ) : null}

      {step === 2 ? (
        <>
          <Stack gap={8}>
            <PageTitle>Домашка за минуту</PageTitle>
            <p className={s.text}>
              После урока впишите тему. ИИ соберёт теорию, разбор примера и задачи в готовый
              брендированный под вас PDF.
            </p>
          </Stack>
          <Field label="Подпишем материал вашим именем">
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Например: Анна Сергеевна"
              maxLength={100}
            />
          </Field>
          <div className={s.topicRow}>
            <div className={s.topicMain}>
              <span className={s.topicLabel}>Тема урока · {demo.subject}</span>
              <span className={s.topicName}>{demo.topic}</span>
            </div>
            <span className={s.topicStatus} aria-live="polite">{DEMO_STATUS[demoTick]}</span>
          </div>
          {demoTick === 0 ? (
            <div className={s.plan}>
              {DEMO_PLAN.map((label, i) => (
                <div key={label} className={s.planRow}>
                  <span className={s.planNum}>{i + 1}</span>
                  <span>{label}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className={s.sheet}>
              <div className={s.sheetHead}>
                <span className={s.sheetTopic}>{demo.topic}</span>
                <span className={s.sheetTutor}>{name.trim() || 'Репетитор'}</span>
              </div>
              <div className={cx(s.part, demoTick > 1 && s.shown)}>
                <span className={s.partLabel}>Теория</span>
                {demo.theory.map((t) => (
                  <div key={t.h} className={s.line}>
                    <b>{t.h}.</b> {t.p}
                  </div>
                ))}
              </div>
              <div className={cx(s.part, s.exampleBox, demoTick > 2 && s.shown)}>
                <span className={s.partLabel}>Пример</span>
                <div className={s.line}>{demo.example.task}</div>
                <div className={cx(s.line, s.solution)}>{demo.example.solution}</div>
              </div>
              <div className={cx(s.part, demoTick > 3 && s.shown)}>
                <span className={s.partLabel}>Домашнее задание</span>
                {demo.homework.map((task, i) => (
                  <div key={task} className={s.task}>
                    <span className={s.taskNum}>{i + 1}</span>
                    <span>{task}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      ) : null}

      {step === 3 ? (
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

      {step === 4 ? (
        <>
          <Stack gap={8}>
            <PageTitle>Расписание с фото</PageTitle>
            <p className={s.text}>
              Не нужно вносить занятия по одному. Покажите приложению своё расписание — оно перенесёт
              его в календарь само.
            </p>
          </Stack>
          <div className={s.plan}>
            {IMPORT_PLAN.map((label, i) => (
              <div key={label} className={s.planRow}>
                <span className={s.planNum}>{i + 1}</span>
                <span>{label}</span>
              </div>
            ))}
          </div>
          <div className={s.glass}>
            Подойдёт фото страницы блокнота, скриншот заметок или таблицы. Загрузить расписание
            можно и позже — кнопка есть в календаре.
          </div>
        </>
      ) : null}

      {step === 5 ? (
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

      <div className={s.actions}>
        <Button onClick={primary.onClick} disabled={primary.disabled || busy}>
          {busy ? 'Сохраняем…' : primary.label}
        </Button>
        {step === 2 && demoTick < DEMO_DONE ? (
          <button type="button" className={s.skip} onClick={leaveDemo} disabled={busy}>
            Пропустить
          </button>
        ) : null}
        {step === 4 ? (
          <Button variant="secondary" onClick={() => setStep(5)} disabled={busy}>
            Позже, сначала ученик
          </Button>
        ) : null}
        {step === 5 ? (
          <Button variant="secondary" onClick={() => finish()} disabled={busy}>
            Сделаю позже
          </Button>
        ) : null}
      </div>
    </div>
  )
}
