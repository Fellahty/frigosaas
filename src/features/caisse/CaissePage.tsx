import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { collection, getDocs, addDoc, Timestamp, query, where } from 'firebase/firestore';
import { useTranslation } from 'react-i18next';
import { db } from '../../lib/firebase';
import { useTenantId } from '../../lib/hooks/useTenantId';
import { Card } from '../../components/Card';
import { Table, TableHead, TableBody, TableRow, TableHeader, TableCell } from '../../components/Table';
import { Spinner } from '../../components/Spinner';

type EntryType = 'in' | 'out';

interface CashEntry {
  id: string;
  date: Date;
  description: string;
  amount: number;
  type: EntryType;
  createdAt: Date;
  clientId?: string | null;
  clientName?: string;
}

interface ClientOption { id: string; name: string }

export const CaissePage: React.FC = () => {
  const { t } = useTranslation();
  const tenantId = useTenantId();
  const queryClient = useQueryClient();

  const [isAdding, setIsAdding] = React.useState(false);
  const [form, setForm] = React.useState<{ date: string; description: string; amount: number; type: EntryType; clientId: string }>({
    date: new Date().toISOString().slice(0, 10),
    description: '',
    amount: 0,
    type: 'in',
    clientId: '',
  });

  // Load clients for selection
  const { data: clientOptions } = useQuery({
    queryKey: ['clients', tenantId, 'for-caisse'],
    queryFn: async (): Promise<ClientOption[]> => {
      const q = query(collection(db, 'clients'), where('tenantId', '==', tenantId));
      const snap = await getDocs(q);
      return snap.docs.map((d) => {
        const data = d.data() as any;
        return { id: d.id, name: data.name || '—' };
      });
    },
  });

  const { data: entries, isLoading, error } = useQuery({
    queryKey: ['cash-entries', tenantId],
    queryFn: async (): Promise<CashEntry[]> => {
      const q = query(collection(db, 'cash_entries'), where('tenantId', '==', tenantId));
      const snap = await getDocs(q);
      const list = snap.docs.map((d) => {
        const data = d.data() as any;
        return {
          id: d.id,
          date: data.date?.toDate?.() || data.date || new Date(),
          description: data.description || '',
          amount: Number(data.amount) || 0,
          type: (data.type as EntryType) || 'in',
          createdAt: data.createdAt?.toDate?.() || new Date(),
          clientId: data.clientId || null,
          clientName: data.clientName || '',
        };
      });
      // Sort descending by date on the client to avoid Firestore composite index requirement
      return list.sort((a, b) => (new Date(b.date as any).getTime() - new Date(a.date as any).getTime()));
    },
  });

  const addEntry = useMutation({
    mutationFn: async (payload: typeof form) => {
      const selectedClient = (clientOptions || []).find((c) => c.id === payload.clientId);
      await addDoc(collection(db, 'cash_entries'), {
        tenantId,
        date: payload.date ? Timestamp.fromDate(new Date(payload.date)) : Timestamp.fromDate(new Date()),
        description: payload.description,
        amount: Number(payload.amount) || 0,
        type: payload.type,
        clientId: payload.type === 'in' ? (payload.clientId || null) : null,
        clientName: payload.type === 'in' ? (selectedClient?.name || '') : '',
        createdAt: Timestamp.fromDate(new Date()),
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['cash-entries', tenantId] });
      setIsAdding(false);
      setForm({ date: new Date().toISOString().slice(0, 10), description: '', amount: 0, type: 'in', clientId: '' });
    },
  });

  const balance = Array.isArray(entries)
    ? entries.reduce((sum, e) => sum + (e.type === 'in' ? e.amount : -e.amount), 0)
    : 0;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="text-center">
          <Spinner size="lg" className="mx-auto mb-4" />
          <p className="text-gray-600">{t('common.loading')}</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
        <p className="font-medium">{t('caisse.errorLoading', 'Erreur de chargement')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 text-sm md:text-base">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-2">{t('caisse.title', 'Caisse')}</h1>
          <p className="text-gray-600">{t('caisse.subtitle', 'Suivez vos entrées/sorties de caisse')}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              setForm({ date: new Date().toISOString().slice(0, 10), description: '', amount: 0, type: 'in' });
              setIsAdding(true);
            }}
            className="inline-flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5"><path fillRule="evenodd" d="M12 4.5a.75.75 0 01.75.75V11h5.75a.75.75 0 010 1.5H12.75v5.75a.75.75 0 01-1.5 0V12.5H5.5a.75.75 0 010-1.5h5.75V5.25A.75.75 0 0112 4.5z" clipRule="evenodd" /></svg>
            {t('caisse.addEntry', 'Ajouter une entrée')}
          </button>
          <button
            onClick={() => {
              setForm({ date: new Date().toISOString().slice(0, 10), description: '', amount: 0, type: 'out' });
              setIsAdding(true);
            }}
            className="inline-flex items-center gap-2 bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5"><path fillRule="evenodd" d="M5.47 5.47a.75.75 0 011.06 0L12 10.94l5.47-5.47a.75.75 0 111.06 1.06L13.06 12l5.47 5.47a.75.75 0 11-1.06 1.06L12 13.06l-5.47 5.47a.75.75 0 11-1.06-1.06L10.94 12 5.47 6.53a.75.75 0 010-1.06z" clipRule="evenodd" /></svg>
            {t('caisse.addOut', 'Ajouter une sortie')}
          </button>
        </div>
      </div>

      <Card>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-4 rounded-lg border bg-white">
            <div className="text-sm text-gray-600">{t('caisse.balance', 'Solde')}</div>
            <div className="mt-1 text-2xl font-bold text-blue-600">{balance.toFixed(2)} MAD</div>
          </div>
          <div className="p-4 rounded-lg border bg-white">
            <div className="text-sm text-gray-600">{t('caisse.totalIn', 'Entrées')}</div>
            <div className="mt-1 text-2xl font-bold text-green-600">{(entries||[]).filter(e=>e.type==='in').reduce((s,e)=>s+e.amount,0).toFixed(2)} MAD</div>
          </div>
          <div className="p-4 rounded-lg border bg-white">
            <div className="text-sm text-gray-600">{t('caisse.totalOut', 'Sorties')}</div>
            <div className="mt-1 text-2xl font-bold text-red-600">{(entries||[]).filter(e=>e.type==='out').reduce((s,e)=>s+e.amount,0).toFixed(2)} MAD</div>
          </div>
        </div>
      </Card>

      {isAdding && (
        <Card>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('caisse.date', 'Date')}</label>
              <input
                type="date"
                value={form.date}
                onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
                className="w-full border rounded-md px-3 py-2"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('caisse.description', 'Description')}</label>
              <input
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                className="w-full border rounded-md px-3 py-2"
                placeholder={t('caisse.descriptionPlaceholder', 'Ex: Règlement client') as string}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('billing.amount', 'Montant')}</label>
              <input
                type="number"
                min={0}
                step={0.01}
                value={form.amount}
                onChange={(e) => setForm((f) => ({ ...f, amount: Number(e.target.value) }))}
                className="w-full border rounded-md px-3 py-2"
                placeholder="0.00"
              />
            </div>
            {form.type === 'in' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('billing.client', 'Client')}</label>
                <select
                  value={form.clientId}
                  onChange={(e) => setForm((f) => ({ ...f, clientId: e.target.value }))}
                  className="w-full border rounded-md px-3 py-2"
                >
                  <option value="">{t('billing.selectClient', 'Sélectionner un client')}</option>
                  {(clientOptions || []).map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('caisse.type', 'Type')}</label>
              <select
                value={form.type}
                onChange={(e) => setForm((f) => ({ ...f, type: e.target.value as EntryType }))}
                className="w-full border rounded-md px-3 py-2"
              >
                <option value="in">{t('caisse.typeIn', 'Entrée')}</option>
                <option value="out">{t('caisse.typeOut', 'Sortie')}</option>
              </select>
            </div>
          </div>
          <div className="mt-4 flex items-center gap-3">
            <button
              onClick={() => addEntry.mutate(form)}
              disabled={!form.date || !form.description || form.amount <= 0 || (form.type==='in' && !form.clientId) || addEntry.isLoading}
              className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 disabled:opacity-60"
            >
              {addEntry.isLoading ? t('common.loading') : t('common.save')}
            </button>
            <button onClick={() => setIsAdding(false)} className="bg-gray-100 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-200">
              {t('common.cancel')}
            </button>
          </div>
        </Card>
      )}

      <Card>
        <Table>
          <TableHead>
            <TableRow>
              <TableHeader>{t('caisse.date', 'Date')}</TableHeader>
              <TableHeader>{t('caisse.description', 'Description')}</TableHeader>
              <TableHeader>{t('billing.client', 'Client')}</TableHeader>
              <TableHeader>{t('billing.amount', 'Montant')}</TableHeader>
              <TableHeader>{t('caisse.type', 'Type')}</TableHeader>
            </TableRow>
          </TableHead>
          <TableBody>
            {Array.isArray(entries) && entries.length > 0 ? (
              entries.map((e) => (
                <TableRow key={e.id}>
                  <TableCell className="whitespace-nowrap">{e.date instanceof Date ? e.date.toLocaleDateString() : e.date}</TableCell>
                  <TableCell>{e.description}</TableCell>
                  <TableCell>{e.clientName || '-'}</TableCell>
                  <TableCell className={e.type==='in' ? 'text-green-700' : 'text-red-700'}>{e.amount.toFixed(2)} MAD</TableCell>
                  <TableCell>
                    <span className={`px-2 py-1 text-xs rounded-full border ${e.type==='in' ? 'bg-green-50 border-green-200 text-green-700' : 'bg-red-50 border-red-200 text-red-700'}`}>
                      {e.type==='in' ? t('caisse.typeIn', 'Entrée') : t('caisse.typeOut', 'Sortie')}
                    </span>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8 text-gray-500">
                  {t('caisse.noEntries', 'Aucune entrée')}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
};


