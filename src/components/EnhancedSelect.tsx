import React from 'react';
import { useTranslation } from 'react-i18next';

interface SelectOption {
  id: string;
  label: string;
  icon?: string;
  value: string;
}

interface EnhancedSelectProps {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  options: SelectOption[];
  editOptions?: SelectOption[];
  onEdit?: (id: string) => void;
  onAdd?: () => void;
  addLabel: string;
  editLabel: string;
  className?: string;
}

export const EnhancedSelect: React.FC<EnhancedSelectProps> = ({
  value,
  onChange,
  placeholder,
  options,
  editOptions = [],
  onEdit,
  onAdd,
  addLabel,
  editLabel,
  className = "w-full border rounded-md px-3 py-2"
}) => {
  const { t } = useTranslation();

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedValue = e.target.value;
    
    if (selectedValue === 'add') {
      onAdd?.();
    } else if (selectedValue.startsWith('edit-')) {
      const id = selectedValue.replace('edit-', '');
      onEdit?.(id);
    } else {
      onChange(selectedValue);
    }
  };

  return (
    <select
      value={value}
      onChange={handleChange}
      className={className}
    >
      <option value="">{placeholder}</option>
      
      {/* Options existantes */}
      {options.map((option) => (
        <option key={option.id} value={option.value}>
          {option.icon && `${option.icon} `}{option.label}
        </option>
      ))}
      
      {/* Options d'édition */}
      {editOptions.length > 0 && (
        <>
          <option disabled className="text-gray-400">--- Actions ---</option>
          {editOptions.map((option) => (
            <option 
              key={`edit-${option.id}`} 
              value={`edit-${option.id}`} 
              className="text-orange-600"
            >
              ✏️ {editLabel} {option.icon && `${option.icon} `}{option.label}
            </option>
          ))}
        </>
      )}
      
      {/* Option d'ajout */}
      <option value="add" className="text-blue-600 font-medium">
        ➕ {addLabel}
      </option>
    </select>
  );
};
