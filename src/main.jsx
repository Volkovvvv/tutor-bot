import React from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './app/index.js'
import { initTelegram } from './shared/api/telegram.js'
import './shared/ui/styles/global.css'

// ready() до первого рендера: useStore начинает вход сразу при монтировании,
// а эффекты дочерних хуков выполняются раньше эффектов App. Если сказать
// Telegram «готово» только внутри App, вход успеет стартовать до этого
// и на части клиентов получит пустой initData.
initTelegram()

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
