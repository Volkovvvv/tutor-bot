// view: { name, id?, studentId?, from? }
export const LIST_VIEWS = ['students', 'lessons']

export function backTarget(view) {
  if (view.name === 'lesson' && view.from === 'student') return { name: 'student', id: view.studentId }
  if (view.name === 'lesson') return { name: 'lessons' }
  if (view.name === 'student') return { name: 'students' }
  if (view.name === 'addStudent') return { name: 'students' }
  if (view.name === 'importStudents') return { name: 'students' }
  if (view.name === 'addLesson') {
    return view.studentId ? { name: 'student', id: view.studentId } : { name: 'lessons' }
  }
  return { name: 'students' }
}
