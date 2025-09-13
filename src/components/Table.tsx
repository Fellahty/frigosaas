import React from 'react';

interface TableProps {
  children: React.ReactNode;
  className?: string;
}

export const Table: React.FC<TableProps> = ({ children, className = '' }) => {
  return (
    <div className={`overflow-x-auto ${className}`}>
      <table className="min-w-full divide-y divide-gray-200">
        {children}
      </table>
    </div>
  );
};

export const TableHead: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <thead className="bg-gray-50 text-xs md:text-sm">{children}</thead>
);

export const TableBody: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <tbody className="bg-white divide-y divide-gray-200 text-sm md:text-base">{children}</tbody>
);

export const TableRow: React.FC<{ children: React.ReactNode; className?: string; id?: string }> = ({ 
  children, 
  className = '',
  id
}) => (
  <tr id={id} className={`hover:bg-gray-50 ${className}`}>{children}</tr>
);

export const TableHeader: React.FC<{ children: React.ReactNode; className?: string; colSpan?: number }> = ({ 
  children, 
  className = '',
  colSpan,
}) => (
  <th colSpan={colSpan} className={`px-4 md:px-6 py-2.5 md:py-3 text-left text-[10px] md:text-xs font-medium text-gray-500 uppercase tracking-wider ${className}`}>
    {children}
  </th>
);

export const TableCell: React.FC<{ children: React.ReactNode; className?: string; colSpan?: number }> = ({ 
  children, 
  className = '',
  colSpan,
}) => (
  <td colSpan={colSpan} className={`px-4 md:px-6 py-3 md:py-4 whitespace-nowrap text-[13px] md:text-sm text-gray-900 ${className}`}>
    {children}
  </td>
);
