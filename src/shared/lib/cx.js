// Склеивает имена классов, пропуская пустые: cx(s.btn, active && s.on)
export function cx(...names) {
  return names.filter(Boolean).join(' ')
}
