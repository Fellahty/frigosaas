import React from 'react';
import { useTranslation } from 'react-i18next';

export const LangSwitcher: React.FC = () => {
  const { i18n } = useTranslation();

  const changeLanguage = (lng: string) => {
    i18n.changeLanguage(lng);
  };

  return (
    <div className="flex items-center space-x-2">
      <button
        onClick={() => changeLanguage('fr')}
        className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
          i18n.language === 'fr'
            ? 'bg-blue-600 text-white'
            : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
        }`}
      >
        FR
      </button>
      <button
        onClick={() => changeLanguage('ar')}
        className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
          i18n.language === 'ar'
            ? 'bg-blue-600 text-white'
            : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
        }`}
      >
        AR
      </button>
    </div>
  );
};
