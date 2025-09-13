import React from 'react';

interface FormCardProps {
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
  icon?: React.ReactNode;
}

export const FormCard: React.FC<FormCardProps> = ({ 
  title, 
  description, 
  children, 
  className = '',
  icon
}) => {
  return (
    <div className={`bg-white border border-gray-200 rounded-xl shadow-sm ${className}`}>
      <div className="px-6 py-5 border-b border-gray-100">
        <div className="flex items-center space-x-3">
          {icon && (
            <div className="p-2 bg-gray-50 rounded-lg">
              {icon}
            </div>
          )}
          <div>
            <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
            {description && (
              <p className="mt-1 text-sm text-gray-600">{description}</p>
            )}
          </div>
        </div>
      </div>
      <div className="px-6 py-6">
        {children}
      </div>
    </div>
  );
};
