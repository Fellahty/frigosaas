import React from 'react';
import { useTranslation } from 'react-i18next';

interface SaveBarProps {
  onSave: () => void;
  onCancel: () => void;
  isDirty: boolean;
  isValid: boolean;
  isSaving?: boolean;
}

export const SaveBar: React.FC<SaveBarProps> = ({ 
  onSave, 
  onCancel, 
  isDirty, 
  isValid, 
  isSaving = false 
}) => {
  const { t } = useTranslation();

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-sm border-t border-gray-200 px-6 py-4 z-10 shadow-lg">
      <div className="max-w-7xl mx-auto flex justify-between items-center">
        <div className="text-sm text-gray-500">
          {isDirty && (
            <span className="flex items-center space-x-2">
              <div className="w-2 h-2 bg-orange-400 rounded-full"></div>
              <span>Modifications non sauvegardées</span>
            </span>
          )}
        </div>
        <div className="flex space-x-3">
          <button
            type="button"
            onClick={onCancel}
            className="px-6 py-2.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
          >
            {t('common.cancel')}
          </button>
          <button
            type="button"
            onClick={onSave}
            disabled={!isDirty || !isValid || isSaving}
            className={`px-6 py-2.5 text-sm font-medium rounded-lg focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-all duration-200 ${
              !isDirty || !isValid || isSaving
                ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                : 'bg-blue-600 text-white hover:bg-blue-700 shadow-sm hover:shadow-md'
            }`}
          >
            {isSaving ? (
              <span className="flex items-center space-x-2">
                <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <span>{t('common.saving', 'Sauvegarde...')}</span>
              </span>
            ) : (
              <span className="flex items-center space-x-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span>{t('common.save')}</span>
              </span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
