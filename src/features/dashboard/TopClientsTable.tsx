import React from 'react';
import { useTranslation } from 'react-i18next';
import { Card } from '../../components/Card';
import { Table, TableHead, TableBody, TableRow, TableHeader, TableCell } from '../../components/Table';
import { TopClient } from '../../types/metrics';

interface TopClientsTableProps {
  topClients?: TopClient[];
}

export const TopClientsTable: React.FC<TopClientsTableProps> = ({ topClients = [] }) => {
  const { t } = useTranslation();

  return (
    <Card title={t('dashboard.topClients')}>
      <Table>
        <TableHead>
          <TableRow>
            <TableHeader>{t('dashboard.clientName')}</TableHeader>
            <TableHeader>{t('dashboard.usage')}</TableHeader>
            <TableHeader>{t('dashboard.lastVisit')}</TableHeader>
          </TableRow>
        </TableHead>
        <TableBody>
          {topClients.length > 0 ? (
            topClients.map((client) => (
              <TableRow key={client.id}>
                <TableCell className="font-medium">{client.name}</TableCell>
                <TableCell>{client.usage}</TableCell>
                <TableCell>{new Date(client.lastVisit).toLocaleDateString()}</TableCell>
              </TableRow>
            ))
          ) : (
            <TableRow>
              <TableCell colSpan={3} className="text-center text-gray-500 py-8">
                {t('dashboard.noTopClients')}
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </Card>
  );
};
