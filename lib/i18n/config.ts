export const defaultLocale = 'en'
export const locales = ['en', 'fr', 'es'] as const
export type ValidLocale = typeof locales[number]

export const localeNames: Record<ValidLocale, string> = {
  en: 'English',
  fr: 'Français',
  es: 'Español',
}

export const dictionaries = {
  en: () => import('./dictionaries/en.json').then((module) => module.default),
  fr: () => import('./dictionaries/fr.json').then((module) => module.default),
  es: () => import('./dictionaries/es.json').then((module) => module.default),
}