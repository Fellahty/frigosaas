import React from 'react';

interface SeasonConfig {
  summer: { months: number[]; duration: number; name: string };
  autumn: { months: number[]; duration: number; name: string };
  winter: { months: number[]; duration: number; name: string };
  spring: { months: number[]; duration: number; name: string };
}

interface SeasonConfigProps {
  config: SeasonConfig;
  onConfigChange: (config: SeasonConfig) => void;
}

export const SeasonConfigComponent: React.FC<SeasonConfigProps> = ({ config, onConfigChange }) => {
  const updateSeason = (season: keyof SeasonConfig, field: 'months' | 'duration' | 'name', value: any) => {
    onConfigChange({
      ...config,
      [season]: {
        ...config[season],
        [field]: value
      }
    });
  };

  const addMonth = (season: keyof SeasonConfig, month: number) => {
    const currentMonths = config[season].months;
    if (!currentMonths.includes(month)) {
      updateSeason(season, 'months', [...currentMonths, month].sort());
    }
  };

  const removeMonth = (season: keyof SeasonConfig, month: number) => {
    updateSeason(season, 'months', config[season].months.filter(m => m !== month));
  };

  const monthNames = [
    'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
    'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
  ];

  return (
    <div className="space-y-6">
      <div className="bg-blue-50 p-4 rounded-lg">
        <h3 className="text-lg font-semibold text-blue-900 mb-2">Configuration des Saisons</h3>
        <p className="text-sm text-blue-700">
          Définissez les périodes de saison et leur durée de stockage pour calculer les échéances de paiement.
        </p>
      </div>

      {Object.entries(config).map(([seasonKey, season]) => (
        <div key={seasonKey} className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-md font-semibold text-gray-900 capitalize">{season.name}</h4>
            <div className="flex items-center space-x-2">
              <label className="text-sm text-gray-600">Durée (mois):</label>
              <input
                type="number"
                min="1"
                max="12"
                value={season.duration}
                onChange={(e) => updateSeason(seasonKey as keyof SeasonConfig, 'duration', parseInt(e.target.value))}
                className="w-16 px-2 py-1 border border-gray-300 rounded text-sm"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">Mois inclus:</label>
            <div className="flex flex-wrap gap-2">
              {monthNames.map((monthName, index) => (
                <button
                  key={index}
                  onClick={() => 
                    season.months.includes(index) 
                      ? removeMonth(seasonKey as keyof SeasonConfig, index)
                      : addMonth(seasonKey as keyof SeasonConfig, index)
                  }
                  className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                    season.months.includes(index)
                      ? 'bg-blue-100 text-blue-800 border border-blue-300'
                      : 'bg-gray-100 text-gray-600 border border-gray-300 hover:bg-gray-200'
                  }`}
                >
                  {monthName}
                </button>
              ))}
            </div>
          </div>
        </div>
      ))}

      <div className="bg-green-50 p-4 rounded-lg">
        <h4 className="text-md font-semibold text-green-900 mb-2">Résumé</h4>
        <div className="text-sm text-green-700 space-y-1">
          {Object.entries(config).map(([seasonKey, season]) => (
            <div key={seasonKey}>
              <strong>{season.name}:</strong> {season.months.map(m => monthNames[m]).join(', ')} 
              <span className="text-gray-600"> ({season.duration} mois de stockage)</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// Default season configuration
export const defaultSeasonConfig: SeasonConfig = {
  summer: {
    months: [5, 6, 7], // June, July, August
    duration: 4,
    name: 'Été'
  },
  autumn: {
    months: [8, 9, 10], // September, October, November
    duration: 5,
    name: 'Automne'
  },
  winter: {
    months: [11, 0, 1], // December, January, February
    duration: 8,
    name: 'Hiver'
  },
  spring: {
    months: [2, 3, 4], // March, April, May
    duration: 6,
    name: 'Printemps'
  }
};
