import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import * as Localization from 'expo-localization';
import AsyncStorage from '@react-native-async-storage/async-storage';
import en from './locales/en.json';
import ru from './locales/ru.json';

const LANGUAGE_KEY = '@pulse-chat/language';

export const resources = { en: { translation: en }, ru: { translation: ru } };

async function getStoredLanguage(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(LANGUAGE_KEY);
  } catch {
    return null;
  }
}

export async function setLanguage(lang: 'ru' | 'en') {
  await AsyncStorage.setItem(LANGUAGE_KEY, lang);
  await i18n.changeLanguage(lang);
}

i18n.use(initReactI18next).init({
  resources,
  lng: Localization.locale.startsWith('en') ? 'en' : 'ru',
  fallbackLng: 'ru',
  interpolation: { escapeValue: false },
});

getStoredLanguage().then((lang) => {
  if (lang === 'ru' || lang === 'en') i18n.changeLanguage(lang);
});

export default i18n;
