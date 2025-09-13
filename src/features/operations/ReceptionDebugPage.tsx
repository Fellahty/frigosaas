import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { collection, getDocs, query, where, limit } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useTenantId } from '../../lib/hooks/useTenantId';
import { Card } from '../../components/Card';

export const ReceptionDebugPage: React.FC = () => {
  const tenantId = useTenantId();

  // Query to get all receptions for debugging
  const { data: receptions, isLoading, error } = useQuery({
    queryKey: ['receptions-debug', tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      
      try {
        const receptionsRef = collection(db, 'receptions');
        const q = query(receptionsRef, where('tenantId', '==', tenantId), limit(10));
        const querySnapshot = await getDocs(q);
        
        return querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
      } catch (error) {
        console.error('Error fetching receptions:', error);
        throw error;
      }
    },
    enabled: !!tenantId,
  });

  if (isLoading) {
    return <div className="p-4">Loading...</div>;
  }

  if (error) {
    return <div className="p-4 text-red-500">Error: {error.message}</div>;
  }

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">Reception Debug Page</h1>
      
      <Card className="p-4 mb-4">
        <h2 className="text-lg font-semibold mb-2">Debug Info</h2>
        <p><strong>Tenant ID:</strong> {tenantId || 'Not available'}</p>
        <p><strong>Total Receptions:</strong> {receptions?.length || 0}</p>
      </Card>

      {receptions && receptions.length > 0 ? (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">Recent Receptions</h2>
          {receptions.map((reception: any) => (
            <Card key={reception.id} className="p-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p><strong>ID:</strong> {reception.id}</p>
                  <p><strong>Serial:</strong> {reception.serial || 'No serial'}</p>
                  <p><strong>Client Name:</strong> {reception.clientName || 'No name'}</p>
                  <p><strong>Client Phone:</strong> {reception.clientPhone || 'No phone'}</p>
                  <p><strong>Client Company:</strong> {reception.clientCompany || 'No company'}</p>
                </div>
                <div>
                  <p><strong>Truck Number:</strong> {reception.truckNumber || 'No truck'}</p>
                  <p><strong>Driver Name:</strong> {reception.driverName || 'No driver'}</p>
                  <p><strong>Product:</strong> {reception.productName || 'No product'}</p>
                  <p><strong>Total Crates:</strong> {reception.totalCrates || 0}</p>
                  <p><strong>Status:</strong> {reception.status || 'No status'}</p>
                </div>
              </div>
              <div className="mt-2">
                <a 
                  href={`/reception/${reception.serial}`}
                  className="text-blue-600 hover:underline"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Test Link: /reception/{reception.serial}
                </a>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="p-4">
          <p>No receptions found. Create a reception first to test the QR code functionality.</p>
        </Card>
      )}
    </div>
  );
};
