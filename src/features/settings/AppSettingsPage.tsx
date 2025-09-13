import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useTenantId } from '../../lib/hooks/useTenantId';
import { useAppSettings, AppSettings } from '../../lib/hooks/useAppSettings';
import { logCreate } from '../../lib/logging';

const AppSettingsPage: React.FC = () => {
  const { t } = useTranslation();
  const tenantId = useTenantId();
  const queryClient = useQueryClient();
  const { settings, isLoading } = useAppSettings();
  
  const [formData, setFormData] = useState<AppSettings>(settings);
  const [isEditing, setIsEditing] = useState(false);

  const updateSettings = useMutation({
    mutationFn: async (newSettings: AppSettings) => {
      if (!tenantId) throw new Error('No tenant ID');
      
      const docRef = doc(db, 'tenants', tenantId, 'settings', 'app');
      await setDoc(docRef, newSettings, { merge: true });
      await logCreate('settings', 'app', 'Paramètres de l\'application mis à jour', 'admin', 'Administrateur');
      return newSettings;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['app-settings', tenantId] });
      setIsEditing(false);
    },
  });

  const handleSave = () => {
    updateSettings.mutate(formData);
  };

  const handleCancel = () => {
    setFormData(settings);
    setIsEditing(false);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Paramètres de l'application</h1>
          <p className="text-gray-600">Configurez les paramètres globaux de votre application</p>
        </div>
        <div className="flex space-x-3">
          {isEditing ? (
            <>
              <button
                onClick={handleCancel}
                className="px-4 py-2 text-gray-600 hover:text-gray-800"
              >
                Annuler
              </button>
              <button
                onClick={handleSave}
                disabled={updateSettings.isPending}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
              >
                {updateSettings.isPending ? 'Sauvegarde...' : 'Sauvegarder'}
              </button>
            </>
          ) : (
            <button
              onClick={() => setIsEditing(true)}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              Modifier
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Date Settings */}
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-semibold mb-4">Paramètres de dates</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Date d'entrée par défaut
              </label>
              <input
                type="date"
                value={formData.defaultEntryDate}
                onChange={(e) => setFormData(prev => ({ ...prev, defaultEntryDate: e.target.value }))}
                disabled={!isEditing}
                className="w-full border rounded-md px-3 py-2 disabled:bg-gray-100"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Date de sortie par défaut
              </label>
              <input
                type="date"
                value={formData.defaultExitDate}
                onChange={(e) => setFormData(prev => ({ ...prev, defaultExitDate: e.target.value }))}
                disabled={!isEditing}
                className="w-full border rounded-md px-3 py-2 disabled:bg-gray-100"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Format de date
              </label>
              <select
                value={formData.dateFormat}
                onChange={(e) => setFormData(prev => ({ ...prev, dateFormat: e.target.value as any }))}
                disabled={!isEditing}
                className="w-full border rounded-md px-3 py-2 disabled:bg-gray-100"
              >
                <option value="DD/MM/YYYY">DD/MM/YYYY</option>
                <option value="MM/DD/YYYY">MM/DD/YYYY</option>
                <option value="YYYY-MM-DD">YYYY-MM-DD</option>
              </select>
            </div>
          </div>
        </div>

        {/* Business Settings */}
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-semibold mb-4">Paramètres métier</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Nom de l'entreprise
              </label>
              <input
                type="text"
                value={formData.companyName}
                onChange={(e) => setFormData(prev => ({ ...prev, companyName: e.target.value }))}
                disabled={!isEditing}
                className="w-full border rounded-md px-3 py-2 disabled:bg-gray-100"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Devise
                </label>
                <input
                  type="text"
                  value={formData.currency}
                  onChange={(e) => setFormData(prev => ({ ...prev, currency: e.target.value }))}
                  disabled={!isEditing}
                  className="w-full border rounded-md px-3 py-2 disabled:bg-gray-100"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Symbole
                </label>
                <input
                  type="text"
                  value={formData.currencySymbol}
                  onChange={(e) => setFormData(prev => ({ ...prev, currencySymbol: e.target.value }))}
                  disabled={!isEditing}
                  className="w-full border rounded-md px-3 py-2 disabled:bg-gray-100"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Durée maximale de réservation (jours)
              </label>
              <input
                type="number"
                value={formData.maxReservationDays}
                onChange={(e) => setFormData(prev => ({ ...prev, maxReservationDays: Number(e.target.value) }))}
                disabled={!isEditing}
                className="w-full border rounded-md px-3 py-2 disabled:bg-gray-100"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Pourcentage minimum de dépôt
              </label>
              <input
                type="number"
                value={formData.minDepositPercentage}
                onChange={(e) => setFormData(prev => ({ ...prev, minDepositPercentage: Number(e.target.value) }))}
                disabled={!isEditing}
                className="w-full border rounded-md px-3 py-2 disabled:bg-gray-100"
              />
            </div>
          </div>
        </div>

        {/* Notification Settings */}
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-semibold mb-4">Notifications</h3>
          <div className="space-y-4">
            <div className="flex items-center">
              <input
                type="checkbox"
                id="emailNotifications"
                checked={formData.emailNotifications}
                onChange={(e) => setFormData(prev => ({ ...prev, emailNotifications: e.target.checked }))}
                disabled={!isEditing}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded disabled:bg-gray-100"
              />
              <label htmlFor="emailNotifications" className="ml-2 text-sm text-gray-700">
                Notifications par email
              </label>
            </div>
            <div className="flex items-center">
              <input
                type="checkbox"
                id="smsNotifications"
                checked={formData.smsNotifications}
                onChange={(e) => setFormData(prev => ({ ...prev, smsNotifications: e.target.checked }))}
                disabled={!isEditing}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded disabled:bg-gray-100"
              />
              <label htmlFor="smsNotifications" className="ml-2 text-sm text-gray-700">
                Notifications par SMS
              </label>
            </div>
          </div>
        </div>

        {/* UI Settings */}
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-semibold mb-4">Interface utilisateur</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Thème
              </label>
              <select
                value={formData.theme}
                onChange={(e) => setFormData(prev => ({ ...prev, theme: e.target.value as any }))}
                disabled={!isEditing}
                className="w-full border rounded-md px-3 py-2 disabled:bg-gray-100"
              >
                <option value="light">Clair</option>
                <option value="dark">Sombre</option>
                <option value="auto">Automatique</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Langue
              </label>
              <select
                value={formData.language}
                onChange={(e) => setFormData(prev => ({ ...prev, language: e.target.value as any }))}
                disabled={!isEditing}
                className="w-full border rounded-md px-3 py-2 disabled:bg-gray-100"
              >
                <option value="fr">Français</option>
                <option value="ar">العربية</option>
                <option value="en">English</option>
              </select>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export { AppSettingsPage };
export default AppSettingsPage;
