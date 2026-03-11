import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { getLocales } from 'expo-localization';
import fr from './fr';
import en from './en';

const deviceLocale = getLocales()[0]?.languageCode ?? 'fr';
const defaultLanguage = deviceLocale.startsWith('fr') ? 'fr' : 'en';

i18n
  .use(initReactI18next)
  .init({
    resources: {
      fr: { translation: fr },
      en: { translation: en },
    },
    lng: defaultLanguage,
    fallbackLng: 'fr',
    interpolation: {
      escapeValue: false,
    },
  });

export default i18n;
