import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { validateCashMovement, generateCashReference, CashValidationResult } from '../lib/cashValidation';

interface CashOperationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: any) => void;
  type: 'in' | 'out';
  currentBalance: number;
  existingReferences: string[];
  isLoading?: boolean;
}

export const CashOperationModal: React.FC<CashOperationModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  type,
  currentBalance,
  existingReferences,
  isLoading = false
}) => {
  const { t } = useTranslation();
  const [form, setForm] = useState({
    amount: '',
    reason: '',
    reference: '',
    paymentMethod: type === 'out' ? 'cash' : 'cash' as 'cash' | 'check' | 'transfer' | 'card',
    notes: '',
  });

  const [validation, setValidation] = useState<CashValidationResult>({
    isValid: true,
    errors: [],
    warnings: []
  });

  const [showWarnings, setShowWarnings] = useState(false);

  // Auto-generate reference on mount
  useEffect(() => {
    if (isOpen && !form.reference) {
      const autoRef = generateCashReference(type, existingReferences);
      setForm(prev => ({ ...prev, reference: autoRef }));
    }
  }, [isOpen, type, existingReferences, form.reference]);

  // Validate form on change
  useEffect(() => {
    if (form.amount && form.reason && form.reference) {
      const validationResult = validateCashMovement(
        {
          type,
          amount: parseFloat(form.amount) || 0,
          paymentMethod: form.paymentMethod,
          reason: form.reason,
          reference: form.reference,
          notes: form.notes,
        },
        {
          currentBalance,
          todayMovements: [], // Would be passed from parent in real implementation
          pendingCollections: [],
        }
      );
      setValidation(validationResult);
    }
  }, [form, type, currentBalance]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validation.isValid) {
      return;
    }

    if (validation.warnings.length > 0 && !showWarnings) {
      setShowWarnings(true);
      return;
    }

    onSubmit({
      type,
      amount: parseFloat(form.amount),
      paymentMethod: form.paymentMethod,
      reason: form.reason,
      reference: form.reference,
      notes: form.notes,
    });
  };

  const handleClose = () => {
    setForm({
      amount: '',
      reason: '',
      reference: '',
      paymentMethod: 'cash',
      notes: '',
    });
    setValidation({ isValid: true, errors: [], warnings: [] });
    setShowWarnings(false);
    onClose();
  };

  if (!isOpen) return null;

  const isInsufficientFunds = type === 'out' && parseFloat(form.amount) > currentBalance;
  const canSubmit = validation.isValid && !isInsufficientFunds;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center space-x-3">
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                type === 'in' 
                  ? 'bg-green-100 text-green-600' 
                  : 'bg-red-100 text-red-600'
              }`}>
                {type === 'in' ? '📥' : '📤'}
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-900">
                  {type === 'in' ? 'Entrée de caisse' : 'Sortie de caisse'}
                </h2>
                <p className="text-sm text-gray-500">
                  Solde actuel: {new Intl.NumberFormat('fr-FR', {
                    style: 'currency',
                    currency: 'MAD'
                  }).format(currentBalance)}
                </p>
              </div>
            </div>
            <button
              onClick={handleClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Amount */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Montant *
              </label>
              <div className="relative">
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.amount}
                  onChange={(e) => setForm(prev => ({ ...prev, amount: e.target.value }))}
                  className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                    validation.errors.some(e => e.includes('montant')) || isInsufficientFunds
                      ? 'border-red-300 bg-red-50'
                      : 'border-gray-300'
                  }`}
                  placeholder="0.00"
                  required
                />
                <div className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500">
                  MAD
                </div>
              </div>
              {isInsufficientFunds && (
                <p className="text-red-600 text-sm mt-1">
                  Solde insuffisant
                </p>
              )}
            </div>

            {/* Payment Method */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Méthode de paiement *
              </label>
              <select
                value={form.paymentMethod}
                onChange={(e) => setForm(prev => ({ 
                  ...prev, 
                  paymentMethod: e.target.value as any 
                }))}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="cash">💵 Espèces</option>
                <option value="check">📄 Chèque</option>
                <option value="transfer">🏦 Virement</option>
                <option value="card">💳 Carte</option>
              </select>
            </div>

            {/* Reason */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Raison *
              </label>
              <textarea
                value={form.reason}
                onChange={(e) => setForm(prev => ({ ...prev, reason: e.target.value }))}
                className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                  validation.errors.some(e => e.includes('raison'))
                    ? 'border-red-300 bg-red-50'
                    : 'border-gray-300'
                }`}
                placeholder="Détaillez la raison de cette opération..."
                rows={3}
                required
              />
            </div>

            {/* Reference */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Référence *
              </label>
              <input
                type="text"
                value={form.reference}
                onChange={(e) => setForm(prev => ({ ...prev, reference: e.target.value }))}
                className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                  validation.errors.some(e => e.includes('référence'))
                    ? 'border-red-300 bg-red-50'
                    : 'border-gray-300'
                }`}
                placeholder="Référence unique"
                required
              />
            </div>

            {/* Notes */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Notes (optionnel)
              </label>
              <textarea
                value={form.notes}
                onChange={(e) => setForm(prev => ({ ...prev, notes: e.target.value }))}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Informations supplémentaires..."
                rows={2}
              />
            </div>

            {/* Validation Errors */}
            {validation.errors.length > 0 && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <div className="flex items-start space-x-2">
                  <span className="text-red-500 text-xl">❌</span>
                  <div>
                    <p className="text-sm font-medium text-red-800 mb-1">
                      Erreurs à corriger:
                    </p>
                    <ul className="text-sm text-red-700 space-y-1">
                      {validation.errors.map((error, index) => (
                        <li key={index}>• {error}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            )}

            {/* Validation Warnings */}
            {validation.warnings.length > 0 && (
              <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                <div className="flex items-start space-x-2">
                  <span className="text-orange-500 text-xl">⚠️</span>
                  <div>
                    <p className="text-sm font-medium text-orange-800 mb-1">
                      Avertissements:
                    </p>
                    <ul className="text-sm text-orange-700 space-y-1">
                      {validation.warnings.map((warning, index) => (
                        <li key={index}>• {warning}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex space-x-3 pt-4">
              <button
                type="button"
                onClick={handleClose}
                className="flex-1 px-4 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                disabled={isLoading}
              >
                Annuler
              </button>
              
              <button
                type="submit"
                disabled={!canSubmit || isLoading}
                className={`flex-1 px-4 py-3 rounded-lg font-medium transition-colors ${
                  canSubmit && !isLoading
                    ? type === 'in'
                      ? 'bg-green-600 hover:bg-green-700 text-white'
                      : 'bg-red-600 hover:bg-red-700 text-white'
                    : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                }`}
              >
                {isLoading ? (
                  <div className="flex items-center justify-center space-x-2">
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    <span>Enregistrement...</span>
                  </div>
                ) : (
                  `Enregistrer ${type === 'in' ? 'l\'entrée' : 'la sortie'}`
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
