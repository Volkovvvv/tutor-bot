import { GRADES } from '../../../entities/student/index.js'
import { Field, Section, Select } from '../../../shared/ui/index.js'

// Класс ученика: под него ИИ собирает теорию и домашку после урока
export default function EditStudentLevel({ student, onChange }) {
  return (
    <Section title="Учёба">
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
    </Section>
  )
}
