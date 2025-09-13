import React, { useState, useEffect, forwardRef, useImperativeHandle } from 'react';
import { useTranslation } from 'react-i18next';
import { FormCard } from '../../../components/FormCard';
import { poolSettingsSchema, type PoolSettings } from '../../../types/settings';
import { useTenantId } from '../../../lib/hooks/useTenantId';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import { toast } from 'react-hot-toast';

interface PoolTabProps {
  onDirtyChange: (dirty: boolean) => void;
  onValidChange: (valid: boolean) => void;
}

export const PoolTab = forwardRef<{ save: () => Promise<void> }, PoolTabProps>(({ onDirtyChange, onValidChange }, ref) => {
  const { t } = useTranslation();
  const tenantId = useTenantId();
  const [formData, setFormData] = useState<PoolSettings>({
    pool_vides_total: 0,
  });
  const [originalData, setOriginalData] = useState<PoolSettings | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    // Initialize with default values immediately
    const defaultData: PoolSettings = {
      pool_vides_total: 0,
    };
    setFormData(defaultData);
    setOriginalData(defaultData);
    
    // Then try to load from Firestore
    loadSettings();
  }, [tenantId]);

  useEffect(() => {
    const validation = poolSettingsSchema.safeParse(formData);
    onValidChange(validation.success);
    
    const isDirty = originalData ? JSON.stringify(formData) !== JSON.stringify(originalData) : false;
    onDirtyChange(isDirty);
  }, [formData, originalData, onDirtyChange, onValidChange]);

  const loadSettings = async () => {
    if (!tenantId) return;
    
    try {
      const docRef = doc(db, 'tenants', tenantId, 'settings', 'pool');
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        const data = docSnap.data() as PoolSettings;
        setFormData(data);
        setOriginalData(data);
      }
    } catch (error) {
      console.error('Error loading pool settings:', error);
      // Don't show error toast, just use defaults
    }
  };

  const handleSave = async () => {
    if (!tenantId) {
      console.error('No tenantId available');
      toast.error('No tenant ID available');
      return;
    }
    
    try {
      const docRef = doc(db, 'tenants', tenantId, 'settings', 'pool');
      await setDoc(docRef, formData);
      setOriginalData(formData);
      onDirtyChange(false);
      toast.success(t('common.success'));
    } catch (error) {
      console.error('Error saving pool settings:', error);
      toast.error(t('common.error'));
    }
  };

  // Expose save function to parent
  useImperativeHandle(ref, () => ({
    save: handleSave
  }), [formData, tenantId]);

  const handleInputChange = (field: keyof PoolSettings, value: number) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  if (isLoading) {
    return <div className="text-center py-8">{t('common.loading')}</div>;
  }

  return (
    <div className="space-y-6">
      <FormCard
        title={t('settings.pool.title', 'Caisses vides')}
        description={t('settings.pool.description', 'Gérez le pool global de caisses vides') as string}
      >
        <div className="grid grid-cols-1 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t('settings.pool.totalEmptyCrates', 'Total caisses vides')}
            </label>
            <input
              type="number"
              min="0"
              value={formData.pool_vides_total}
              onChange={(e) => handleInputChange('pool_vides_total', parseInt(e.target.value) || 0)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="10000"
            />
            <p className="mt-1 text-sm text-gray-500">
              {t('settings.pool.totalHelp', 'Nombre total de caisses vides disponibles')}
            </p>
          </div>

        </div>

        {/* Read-only display section */}
        <div className="mt-8 p-4 bg-gray-50 rounded-lg">
          <h4 className="text-lg font-medium text-gray-900 mb-4">
            {t('settings.pool.status', 'État actuel')}
          </h4>
          <div className="text-center p-6 bg-white rounded-lg">
            <div className="text-4xl font-bold text-blue-600 mb-2">
              {formData.pool_vides_total.toLocaleString()}
            </div>
            <div className="text-lg text-gray-500">
              {t('settings.pool.available', 'Caisses vides disponibles')}
            </div>
          </div>
        </div>
      </FormCard>
    </div>
  );
});
