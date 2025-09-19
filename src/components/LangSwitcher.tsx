import React from 'react';
import { useTranslation } from 'react-i18next';

export const LangSwitcher: React.FC = () => {
  const { i18n } = useTranslation();

  const changeLanguage = (lng: string) => {
    i18n.changeLanguage(lng).catch((error) => {
      console.error('Error changing language:', error);
    });
  };

  return (
    <div className="flex items-center bg-gray-100 rounded-lg p-0.5 shadow-sm border border-gray-200/50">
      <button
        onClick={() => changeLanguage('fr')}
        className={`px-2.5 py-1.5 rounded-md text-xs font-medium transition-all duration-200 ${
          i18n.language === 'fr'
            ? 'bg-white text-gray-900 shadow-sm'
            : 'text-gray-600 hover:text-gray-900 hover:bg-white/50'
        }`}
      >
        FR
      </button>
      <button
        onClick={() => changeLanguage('ar')}
        className={`px-2.5 py-1.5 rounded-md text-xs font-medium transition-all duration-200 ${
          i18n.language === 'ar'
            ? 'bg-white text-gray-900 shadow-sm'
            : 'text-gray-600 hover:text-gray-900 hover:bg-white/50'
        }`}
      >
        AR
      </button>
    </div>
  );
};
