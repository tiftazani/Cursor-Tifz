import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { applyPlatformAttr } from './lib/platform'
import { markStandaloneClass, registerServiceWorker } from './lib/pwa'

applyPlatformAttr()
markStandaloneClass()
registerServiceWorker()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
