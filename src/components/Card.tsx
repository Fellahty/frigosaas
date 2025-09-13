import React from 'react';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  title?: string;
}

export const Card: React.FC<CardProps> = ({ children, className = '', title }) => {
  return (
    <div className={`bg-white rounded-lg shadow-md p-4 md:p-6 ${className}`}>
      {title && (
        <h3 className="text-base md:text-lg font-semibold text-gray-900 mb-3 md:mb-4">{title}</h3>
      )}
      {children}
    </div>
  );
};
