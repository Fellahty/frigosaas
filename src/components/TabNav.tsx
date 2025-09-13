import React from 'react';

interface Tab {
  id: string;
  label: string;
  icon?: React.ReactNode;
  description?: string;
}

interface TabNavProps {
  tabs: Tab[];
  activeTab: string;
  onTabChange: (tabId: string) => void;
}

export const TabNav: React.FC<TabNavProps> = ({ tabs, activeTab, onTabChange }) => {
  return (
    <div className="bg-white border-b border-gray-200">
      <nav className="flex space-x-1 p-1 overflow-x-auto">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={`group relative px-3 py-2 md:px-4 md:py-3 rounded-lg font-medium text-sm transition-all duration-200 flex items-center space-x-2 whitespace-nowrap ${
              activeTab === tab.id
                ? 'bg-blue-50 text-blue-700 border border-blue-200 shadow-sm'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
            }`}
          >
            {tab.icon && (
              <span className={`transition-colors duration-200 flex-shrink-0 ${
                activeTab === tab.id ? 'text-blue-600' : 'text-gray-400 group-hover:text-gray-600'
              }`}>
                {tab.icon}
              </span>
            )}
            <span className="font-medium hidden sm:inline">{tab.label}</span>
            <span className="font-medium sm:hidden text-xs">{tab.label.split(' ')[0]}</span>
            {activeTab === tab.id && (
              <div className="absolute -bottom-1 left-1/2 transform -translate-x-1/2 w-2 h-2 bg-blue-600 rounded-full"></div>
            )}
          </button>
        ))}
      </nav>
    </div>
  );
};
