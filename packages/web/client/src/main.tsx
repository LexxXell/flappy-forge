import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './App.css'
import App from './App'
import { I18nProvider } from './i18n'

// Redirect bare "/" to "/<lang>/"
if (!window.location.pathname.match(/^\/[a-z]{2,5}(\/|$)/i)) {
  const saved = localStorage.getItem('lang') ?? 'en'
  history.replaceState(null, '', `/${saved}/`)
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <I18nProvider>
      <App />
    </I18nProvider>
  </StrictMode>,
)
