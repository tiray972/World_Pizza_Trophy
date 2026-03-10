import { ValidLocale, dictionaries } from './config'

export const getDictionary = async (locale: string): Promise<typeof dictionaries.en> => {
  if (locale === 'en' || locale === 'es' || locale === 'fr') {
    return dictionaries[locale]
  }
  // Fallback to English if locale is not valid
  return dictionaries.en
}