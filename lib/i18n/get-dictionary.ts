import { ValidLocale, dictionaries } from './config'

export const getDictionary = async (locale: ValidLocale) => {
  return dictionaries[locale]()
}