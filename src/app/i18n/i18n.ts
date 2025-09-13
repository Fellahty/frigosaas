import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import fr from './fr.json';
import ar from './ar.json';

const resources = {
  fr: {
    translation: fr,
  },
  ar: {
    translation: ar,
  },
};

i18n
  .use(initReactI18next)
  .init({
    resources,
    lng: 'fr', // default language
    fallbackLng: 'fr',
    interpolation: {
      escapeValue: false, // React already escapes values
    },
  });

// Set document direction on language change
i18n.on('languageChanged', (lng) => {
  if (typeof document !== 'undefined') {
    const isRtl = lng && lng.toLowerCase().startsWith('ar');
    document.documentElement.setAttribute('dir', isRtl ? 'rtl' : 'ltr');
    document.documentElement.setAttribute('lang', lng);
  }
});

// Initialize dir on load
if (typeof document !== 'undefined') {
  const initial = i18n.language || 'fr';
  const isRtl = initial.toLowerCase().startsWith('ar');
  document.documentElement.setAttribute('dir', isRtl ? 'rtl' : 'ltr');
  document.documentElement.setAttribute('lang', initial);
}

export default i18n;
