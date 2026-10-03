import { GOAL_OPTIONS, GRADES } from '../../../entities/student/index.js'
import { Field, Row, Section, Select } from '../../../shared/ui/index.js'

// Класс и цель ученика: под них ИИ собирает теорию и домашку после урока
export default function EditStudentLevel({ student, onChange }) {
  return (
    <Section title="Учёба">
      <Row>
        <Field label="Класс">
          <Select
            value={student.grade ?? ''}
            onChange={(e) => onChange(student.id, { grade: e.target.value ? Number(e.target.value) : null })}
          >
            <option value="">Не указан</option>
            {GRADES.map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </Select>
        </Field>
        <Field label="Цель">
          <Select value={student.goal} onChange={(e) => onChange(student.id, { goal: e.target.value })}>
            {GOAL_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </Select>
        </Field>
      </Row>
    </Section>
  )
}
