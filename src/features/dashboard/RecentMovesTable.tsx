import React from 'react';
import { useTranslation } from 'react-i18next';
import { Card } from '../../components/Card';
import { Table, TableHead, TableBody, TableRow, TableHeader, TableCell } from '../../components/Table';
import { MoveItem } from '../../types/metrics';

interface RecentMovesTableProps {
  recentMoves?: MoveItem[];
}

export const RecentMovesTable: React.FC<RecentMovesTableProps> = ({ recentMoves = [] }) => {
  const { t } = useTranslation();

  return (
    <Card title={t('dashboard.recentMoves')}>
      <Table>
        <TableHead>
          <TableRow>
            <TableHeader>{t('dashboard.clientName')}</TableHeader>
            <TableHeader>{t('dashboard.from')}</TableHeader>
            <TableHeader>{t('dashboard.to')}</TableHeader>
            <TableHeader>{t('dashboard.reason')}</TableHeader>
            <TableHeader>{t('dashboard.time')}</TableHeader>
          </TableRow>
        </TableHead>
        <TableBody>
          {recentMoves.length > 0 ? (
            recentMoves.map((move) => (
              <TableRow key={move.id}>
                <TableCell className="font-medium">{move.clientName}</TableCell>
                <TableCell>{move.fromRoom}</TableCell>
                <TableCell>{move.toRoom}</TableCell>
                <TableCell>{move.reason}</TableCell>
                <TableCell>{new Date(move.timestamp).toLocaleString()}</TableCell>
              </TableRow>
            ))
          ) : (
            <TableRow>
              <TableCell colSpan={5} className="text-center text-gray-500 py-8">
                {t('dashboard.noRecentMoves')}
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </Card>
  );
};
