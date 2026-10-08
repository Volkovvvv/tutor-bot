import { useCallback, useMemo, useRef, useState } from 'react'
import { api } from '../../../shared/api/client.js'
import { cx } from '../../../shared/lib/cx.js'
import { dayMonth } from '../../../shared/lib/date.js'
import { plural, pluralLessons } from '../../../shared/lib/format.js'
import { fileToJpegDataUrl } from '../../../shared/lib/image.js'
import {
  BackButton,
  Badge,
  Button,
  Card,
  ChipGroup,
  EmptyState,
  Field,
  FieldGroup,
  Input,
  MainButton,
  Note,
  PageTitle,
  Row,
  Screen,
  Section,
  Select,
  Stack,
  Switch,
  Textarea,
} from '../../../shared/ui/index.js'
import {
  buildLessons,
  isRowValid,
  NEW_STUDENT,
  newStudentsOf,
  REPEAT_OPTIONS,
  toDraft,
  WEEKDAY_OPTIONS,
} from '../model/draft.js'
import s from './ImportSchedule.module.css'

/**
 * «Расписание с фото»: репетитор снимает или вставляет текстом своё недельное
 * расписание, ИИ превращает его в строки, а дальше — обязательная проверка.
 *
 * Ничего не сохраняется, пока репетитор не посмотрел черновик: перепутанные
 * 16:00 и 18:00 — это напоминание ученику не в то время, от имени репетитора.
 */
export default function ImportSchedule({ students, defaultPrice, onImport, onCancel, onDone, onNotify }) {
  // null — ещё не распознавали; массив — черновик (может быть пустым)
  const [rows, setRows] = useState(null)
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  // Расписание на фото почти всегда недельное — повтор включён сразу
  const [repeat, setRepeat] = useState(true)
  // Цены новых учеников по ключу имени; без записи — цена из профиля
  const [prices, setPrices] = useState({})
  // Одна цена для всех новых учеников: с фото их обычно много, а цена у них общая
  const [allPrice, setAllPrice] = useState('')
  const fileRef = useRef(null)
  // Ученики, созданные неудавшейся попыткой сохранения (см. importSchedule в useStore)
  const createdRef = useRef({})

  const recognize = useCallback(
    async (body) => {
      setBusy(true)
      setError('')
      try {
        const res = await api.post('/lessons/import/recognize', body)
        setRows(toDraft(res.rows, students))
      } catch (e) {
        setError(e.message)
      } finally {
        setBusy(false)
      }
    },
    [students]
  )

  const pickFile = async (e) => {
    const file = e.target.files?.[0]
    // Тот же файл можно выбрать повторно: без сброса change не сработает
    e.target.value = ''
    if (!file) return
    try {
      await recognize({ image: await fileToJpegDataUrl(file) })
    } catch (err) {
      setError(err.message)
    }
  }

  const patchRow = (key, patch) =>
    setRows((list) => list.map((row) => (row.key === key ? { ...row, ...patch } : row)))

  const fresh = useMemo(() => (rows ? newStudentsOf(rows) : []), [rows])
  const lessons = useMemo(() => (rows ? buildLessons(rows) : []), [rows])
  const priceOf = (key) => prices[key] ?? (allPrice || (defaultPrice ? String(defaultPrice) : ''))

  const included = rows?.filter((row) => row.on) ?? []
  const invalid = included.filter((row) => !isRowValid(row)).length
  const noPrice = fresh.filter((st) => !(Number(priceOf(st.key)) > 0))

  // Что мешает сохранить; null — ничего. Кнопка при этом остаётся нажимаемой:
  // молча отключённая кнопка выглядит как сломанная, а тост объясняет причину
  const problem =
    lessons.length === 0
      ? 'Включите хотя бы одно занятие'
      : invalid > 0
        ? 'Укажите день, время и ученика во всех включённых строках'
        : noPrice.length > 0
          ? `Укажите цену занятия: ${noPrice.map((st) => st.name).join(', ')}`
          : null

  const save = async () => {
    if (busy) return
    if (problem) {
      onNotify(problem)
      return
    }
    setBusy(true)
    const result = await onImport({
      newStudents: fresh.map((st) => ({ ...st, price: Number(priceOf(st.key)) })),
      lessons,
      repeat,
      known: createdRef.current,
    })
    setBusy(false)
    createdRef.current = result.studentIds
    if (!result.ok) return // ошибка уже показана через reportError в useStore

    onDone(
      result.created === 0
        ? 'Все эти занятия уже есть в расписании'
        : repeat
          ? 'Расписание добавлено — занятия повторяются каждую неделю'
          : `Добавлено ${pluralLessons(result.created)}` +
            (result.skipped ? ` · ${result.skipped} уже были в расписании` : '')
    )
  }

  if (rows === null) {
    return (
      <Screen>
        <BackButton onClick={onCancel} />
        <PageTitle>Расписание с фото</PageTitle>

        <Note>
          Сфотографируйте расписание из блокнота или загрузите скриншот — приложение
          прочитает учеников, дни и время. Перед сохранением всё можно проверить и поправить.
        </Note>

        <input ref={fileRef} type="file" accept="image/*" className={s.file} onChange={pickFile} />
        <Button onClick={() => fileRef.current?.click()} disabled={busy}>
          {busy ? 'Читаем расписание…' : 'Выбрать фото'}
        </Button>

        <div className={s.or}>или</div>

        <Field label="Вставьте текстом">
          <Textarea
            rows={5}
            maxLength={4000}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={'Пн 16:00 Маша\nСр 18:30 Петя Иванов'}
          />
        </Field>
        <Button
          variant="secondary"
          onClick={() => recognize({ text: text.trim() })}
          disabled={busy || text.trim().length === 0}
        >
          Разобрать текст
        </Button>

        {error ? <Note>{error}</Note> : null}
      </Screen>
    )
  }

  if (rows.length === 0) {
    return (
      <Screen>
        <BackButton onClick={() => setRows(null)} />
        <PageTitle>Расписание с фото</PageTitle>
        <EmptyState icon="🔍" title="Занятий не нашлось">
          Попробуйте снять расписание крупнее и при хорошем свете или вставьте его текстом.
        </EmptyState>
        <Button onClick={() => setRows(null)}>Попробовать ещё раз</Button>
      </Screen>
    )
  }

  const unsure = rows.filter((row) => row.on && row.unsure).length

  return (
    <Screen>
      <BackButton onClick={() => setRows(null)}>Другое фото</BackButton>
      <PageTitle subtitle={`Нашли ${pluralLessons(rows.length)} в неделю`}>Проверьте</PageTitle>

      {unsure > 0 ? (
        <Note>
          {unsure === 1 ? 'Одна строка прочитана' : `${unsure} ${plural(unsure, 'строка прочитана', 'строки прочитаны', 'строк прочитано')}`}{' '}
          неуверенно — сверьте с расписанием.
        </Note>
      ) : null}

      <Stack>
        {rows.map((row) => (
          <Card key={row.key} className={cx(s.row, !row.on && s.off)}>
            <div className={s.rowHead}>
              <span className={s.source}>{row.source}</span>
              {row.on && (row.unsure || !isRowValid(row)) ? <Badge tone="negative">Проверьте</Badge> : null}
              <Switch
                checked={row.on}
                onChange={(on) => patchRow(row.key, { on })}
                label={`Добавить занятие: ${row.source}`}
              />
            </div>

            {row.on ? (
              <>
                <Select
                  className={s.control}
                  aria-label="Ученик"
                  value={row.studentId}
                  onChange={(e) => patchRow(row.key, { studentId: e.target.value })}
                >
                  <option value={NEW_STUDENT}>Новый ученик</option>
                  {students.map((st) => (
                    <option key={st.id} value={st.id}>{st.name}</option>
                  ))}
                </Select>

                {row.studentId === NEW_STUDENT ? (
                  <Input
                    className={s.control}
                    aria-label="Имя нового ученика"
                    value={row.name}
                    maxLength={100}
                    onChange={(e) => patchRow(row.key, { name: e.target.value })}
                    placeholder="Имя ученика"
                  />
                ) : null}

                <Row>
                  <Select
                    className={s.control}
                    aria-label="День недели"
                    value={row.weekday ?? ''}
                    onChange={(e) => patchRow(row.key, { weekday: Number(e.target.value) || null })}
                  >
                    <option value="">День</option>
                    {WEEKDAY_OPTIONS.map(([value, label]) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </Select>
                  <Input
                    className={s.control}
                    type="time"
                    aria-label="Время начала"
                    value={row.time}
                    onChange={(e) => patchRow(row.key, { time: e.target.value })}
                  />
                </Row>
              </>
            ) : null}
          </Card>
        ))}
      </Stack>

      {fresh.length > 0 ? (
        <Section title="Новые ученики — цена за занятие, ₽">
          <Stack>
            {fresh.length > 1 ? (
              <Field label="Одна цена для всех, ₽">
                <Input
                  type="number"
                  inputMode="numeric"
                  value={allPrice}
                  onChange={(e) => {
                    setAllPrice(e.target.value)
                    // Общая цена важнее прежде введённых по одной: иначе она «не работает»
                    setPrices({})
                  }}
                  placeholder="1500"
                />
              </Field>
            ) : null}
            {fresh.map((st) => (
              <label key={st.key} className={s.price}>
                <span className={s.priceName}>{st.name}</span>
                <Input
                  className={s.priceInput}
                  type="number"
                  inputMode="numeric"
                  value={priceOf(st.key)}
                  onChange={(e) => setPrices((p) => ({ ...p, [st.key]: e.target.value }))}
                  placeholder="1500"
                />
              </label>
            ))}
          </Stack>
        </Section>
      ) : null}

      <FieldGroup label="Повтор">
        <ChipGroup options={REPEAT_OPTIONS} value={repeat} onChange={setRepeat} />
      </FieldGroup>

      <div className={s.summary}>
        {problem
          ? `${problem}.`
          : lessons.length > 0
            ? `Первое занятие — ${dayMonth(lessons.reduce((a, l) => (l.date < a ? l.date : a), lessons[0].date))}.` +
              (repeat ? ' Дальше — каждую неделю, пока не остановите.' : '') +
              (fresh.length > 0
                ? ` Появится ${fresh.length} ${plural(fresh.length, 'новый ученик', 'новых ученика', 'новых учеников')}.`
                : '')
            : 'Включите хотя бы одно занятие.'}
      </div>

      <MainButton
        text={busy ? 'Сохраняем…' : lessons.length > 0 ? `Добавить ${pluralLessons(lessons.length)}${repeat ? ' в неделю' : ''}` : 'Добавить'}
        onClick={save}
        disabled={busy}
      />
    </Screen>
  )
}
