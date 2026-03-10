import en from './dictionaries/en.json'
import es from './dictionaries/es.json'
import fr from './dictionaries/fr.json'

export const defaultLocale = 'en'
export const locales = ['en', 'fr', 'es'] as const
export type ValidLocale = 'en' | 'es' | 'fr'

export const localeNames: Record<ValidLocale, string> = {
  en: 'English',
  fr: 'Français',
  es: 'Español',
}

const dictionaries = {
  en,
  es,
  fr,
}

export { dictionaries }