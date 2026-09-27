import React from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './app/index.js'
import './shared/ui/index.css'

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
