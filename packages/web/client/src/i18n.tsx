import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Strings = Record<string, string>

export interface LangMeta { code: string; name: string }

interface I18nCtx {
  t: (key: string, vars?: Record<string, string>) => string
  lang: string
  available: LangMeta[]
  setLang: (code: string) => void
}

// ---------------------------------------------------------------------------
// URL helpers
// ---------------------------------------------------------------------------

/** Extract lang code from pathname: /en/foo → "en" */
function langFromPath(): string {
  const m = window.location.pathname.match(/^\/([a-z]{2,5})(?:\/|$)/i)
  return m ? m[1].toLowerCase() : 'en'
}

/** Replace/add lang prefix in pathname */
function pathWithLang(code: string): string {
  const rest = window.location.pathname.replace(/^\/[a-z]{2,5}(\/|$)/i, '/')
  return `/${code}${rest.startsWith('/') ? rest : '/' + rest}`
}

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

const I18nContext = createContext<I18nCtx>({
  t: (k) => k,
  lang: 'en',
  available: [],
  setLang: () => {},
})

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<string>(langFromPath)
  const [strings, setStrings] = useState<Strings>({})
  const [available, setAvailable] = useState<LangMeta[]>([])

  // Load available languages list once
  useEffect(() => {
    fetch('/locales/index.json')
      .then<LangMeta[]>(r => r.json())
      .then(setAvailable)
      .catch(() => setAvailable([{ code: 'en', name: 'English' }]))
  }, [])

  // Load translations whenever lang changes
  useEffect(() => {
    fetch(`/locales/${lang}.json`)
      .then(r => {
        if (!r.ok) throw new Error(`locale ${lang} not found`)
        return r.json() as Promise<Strings>
      })
      .then(setStrings)
      .catch(() => {
        // Fall back to English
        if (lang !== 'en') {
          fetch('/locales/en.json')
            .then<Strings>(r => r.json())
            .then(setStrings)
            .catch(() => {})
        }
      })
  }, [lang])

  // Keep URL in sync when lang changes via setLang
  function setLang(code: string) {
    setLangState(code)
    history.pushState(null, '', pathWithLang(code))
  }

  // Stable translate function — only changes when strings object changes
  const t = useCallback(
    (key: string, vars?: Record<string, string>): string => {
      let str = strings[key] ?? key
      if (vars) {
        for (const [k, v] of Object.entries(vars)) {
          str = str.replace(`{${k}}`, v)
        }
      }
      return str
    },
    [strings],
  )

  return (
    <I18nContext.Provider value={{ t, lang, available, setLang }}>
      {children}
    </I18nContext.Provider>
  )
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useI18n() {
  return useContext(I18nContext)
}
