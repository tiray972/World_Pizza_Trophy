import en from './dictionaries/en.json'
import es from './dictionaries/es.json'
import fr from './dictionaries/fr.json'
import it from './dictionaries/it.json'

export const defaultLocale = 'en'
export const locales = ['en', 'fr', 'es', 'it'] as const
export type ValidLocale = 'en' | 'es' | 'fr' | 'it'

export const localeNames: Record<ValidLocale, string> = {
  en: 'English',
  fr: 'Français',
  es: 'Español',
  it: 'Italiano',
}

const dictionaries = {
  en,
  es,
  fr,
  it,
}

export { dictionaries }
