import React from 'react';
import { Table, TableHead, TableBody, TableRow, TableHeader, TableCell } from './Table';

interface Column<T> {
  key: string;
  label: string;
  render?: (item: T) => React.ReactNode;
  className?: string;
}

interface DataTableProps<T> {
  data: T[];
  columns: Column<T>[];
  className?: string;
  emptyMessage?: string;
}

export const DataTable = <T extends Record<string, any>>({ 
  data, 
  columns, 
  className = '',
  emptyMessage = 'Aucune donnée disponible'
}: DataTableProps<T>) => {
  if (data.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="text-gray-500">
          <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <h3 className="mt-2 text-sm font-medium text-gray-900">
            {emptyMessage}
          </h3>
        </div>
      </div>
    );
  }

  return (
    <Table className={className}>
      <TableHead>
        <TableRow>
          {columns.map((column) => (
            <TableHeader key={column.key} className={column.className}>
              {column.label}
            </TableHeader>
          ))}
        </TableRow>
      </TableHead>
      <TableBody>
        {data.map((item, index) => (
          <TableRow key={item.id || index}>
            {columns.map((column) => (
              <TableCell key={column.key} className={column.className}>
                {column.render ? column.render(item) : item[column.key]}
              </TableCell>
            ))}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
};
