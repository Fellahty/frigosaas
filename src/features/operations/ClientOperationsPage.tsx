import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useAuth } from '../../lib/hooks/useAuth';
import { Card } from '../../components/Card';
import { Table, TableHead, TableBody, TableRow, TableHeader, TableCell } from '../../components/Table';
import { Spinner } from '../../components/Spinner';

interface ClientOperation {
  id: string;
  type: 'loan' | 'reception';
  status: 'pending' | 'active' | 'completed';
  date: Date;
  description: string;
  quantity?: number;
  location?: string;
}

export const ClientOperationsPage: React.FC = () => {
  const { t } = useTranslation();
  const { user } = useAuth();

  const { data: operations, isLoading, error } = useQuery({
    queryKey: ['client-operations', user?.id],
    queryFn: async (): Promise<ClientOperation[]> => {
      if (!user?.id) return [];
      
      // Query operations for this specific client
      // You'll need to adjust these queries based on your actual data structure
      const operationsQuery = query(
        collection(db, 'tenants', user.tenantId, 'operations'),
        where('clientId', '==', user.id)
      );
      
      const snapshot = await getDocs(operationsQuery);
      return snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          date: data.date?.toDate?.() || new Date(),
          type: data.type || 'unknown',
          status: data.status || 'pending',
          description: data.description || '',
          quantity: data.quantity,
          location: data.location,
          ...data
        } as ClientOperation;
      });
    },
    enabled: !!user?.id,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="text-center">
          <Spinner size="lg" className="mx-auto mb-4" />
          <p className="text-gray-600">{t('common.loading', 'Chargement...')}</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
        <p className="font-medium">{t('common.errorLoading', 'Erreur de chargement')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-2">
            {t('operations.title', 'Mes Opérations')}
          </h1>
          <p className="text-gray-600">
            {t('operations.subtitle', 'Consultez l\'historique de vos opérations')}
          </p>
        </div>
      </div>

      <Card>
        <div className="overflow-x-auto">
          <Table className="min-w-full">
            <TableHead>
              <TableRow className="bg-gray-50">
                <TableHeader className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {t('operations.type', 'Type')}
                </TableHeader>
                <TableHeader className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {t('operations.description', 'Description')}
                </TableHeader>
                <TableHeader className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {t('operations.status', 'Statut')}
                </TableHeader>
                <TableHeader className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {t('operations.date', 'Date')}
                </TableHeader>
                <TableHeader className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {t('operations.quantity', 'Quantité')}
                </TableHeader>
              </TableRow>
            </TableHead>
            <TableBody>
              {operations && operations.length > 0 ? (
                operations.map((operation) => (
                  <TableRow key={operation.id} className="hover:bg-gray-50">
                    <TableCell className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        operation.type === 'loan' 
                          ? 'bg-blue-100 text-blue-800'
                          : 'bg-green-100 text-green-800'
                      }`}>
                        {operation.type === 'loan' 
                          ? t('operations.loan', 'Prêt')
                          : t('operations.reception', 'Réception')
                        }
                      </span>
                    </TableCell>
                    <TableCell className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {operation.description}
                    </TableCell>
                    <TableCell className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        operation.status === 'completed' 
                          ? 'bg-green-100 text-green-800'
                          : operation.status === 'active'
                          ? 'bg-yellow-100 text-yellow-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}>
                        {operation.status === 'completed' 
                          ? t('operations.completed', 'Terminé')
                          : operation.status === 'active'
                          ? t('operations.active', 'En cours')
                          : t('operations.pending', 'En attente')
                        }
                      </span>
                    </TableCell>
                    <TableCell className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {operation.date.toLocaleDateString('fr-FR')}
                    </TableCell>
                    <TableCell className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {operation.quantity || '-'}
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-gray-500">
                    {t('operations.noOperations', 'Aucune opération trouvée')}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  );
};
