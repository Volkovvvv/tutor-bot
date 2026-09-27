import { useEffect } from 'react'

export default function Toast({ message, onHide }) {
  useEffect(() => {
    if (!message) return
    const t = setTimeout(onHide, 2200)
    return () => clearTimeout(t)
  }, [message, onHide])

  if (!message) return null
  return <div className="toast">{message}</div>
}
