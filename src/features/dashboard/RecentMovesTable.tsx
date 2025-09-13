import React from 'react';
import { useTranslation } from 'react-i18next';
import { Card } from '../../components/Card';
import { Table, TableHead, TableBody, TableRow, TableHeader, TableCell } from '../../components/Table';
import { MoveItem } from '../../types/metrics';

interface RecentMovesTableProps {
  recentMoves: MoveItem[];
}

export const RecentMovesTable: React.FC<RecentMovesTableProps> = ({ recentMoves }) => {
  const { t } = useTranslation();

  return (
    <Card title={t('dashboard.recentMoves')}>
      <Table>
        <TableHead>
          <TableRow>
            <TableHeader>{t('clients.name')}</TableHeader>
            <TableHeader>From</TableHeader>
            <TableHeader>To</TableHeader>
            <TableHeader>Reason</TableHeader>
            <TableHeader>Time</TableHeader>
          </TableRow>
        </TableHead>
        <TableBody>
          {recentMoves.map((move) => (
            <TableRow key={move.id}>
              <TableCell className="font-medium">{move.clientName}</TableCell>
              <TableCell>{move.fromRoom}</TableCell>
              <TableCell>{move.toRoom}</TableCell>
              <TableCell>{move.reason}</TableCell>
              <TableCell>{new Date(move.timestamp).toLocaleString()}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Card>
  );
};
