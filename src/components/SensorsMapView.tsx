import React, { useState } from 'react';
import { GoogleMap, LoadScript, Polygon, InfoWindow } from '@react-google-maps/api';

// Define libraries as a constant to avoid re-creating the array
const GOOGLE_MAPS_LIBRARIES: ("places")[] = ['places'];

interface Sensor {
  id: string;
  name: string;
  type: 'temperature' | 'humidity' | 'pressure' | 'motion' | 'light';
  status: 'online' | 'offline' | 'error';
  lastReading?: {
    value: number;
    unit: string;
    timestamp: Date;
  };
  roomId: string;
  additionalData?: {
    temperature: number;
    humidity: number;
    battery: number;
    magnet: number;
    beacons?: any;
    timestamp: Date;
    localTime?: string;
  };
}

interface Room {
  id: string;
  name: string;
  capacity: number;
  sensorId: string;
  active: boolean;
  athGroupNumber?: number;
  boitieSensorId?: string;
  sensors: Sensor[];
  polygon?: Array<{ lat: number; lng: number }>; // Saved GeoJSON polygon
}

interface SensorsMapViewProps {
  rooms: Room[];
  selectedRoom?: Room | null;
  onRoomClick: (room: Room) => void;
}

const SensorsMapView: React.FC<SensorsMapViewProps> = ({ rooms, selectedRoom: initialSelectedRoom, onRoomClick }) => {
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);
  const [infoPosition, setInfoPosition] = useState<{ lat: number; lng: number } | null>(null);
  const [mapCenter, setMapCenter] = useState({ lat: 33.5731, lng: -7.5898 });
  const [mapZoom, setMapZoom] = useState(16);
  const mapRef = React.useRef<google.maps.Map | null>(null);

  // When initialSelectedRoom changes, zoom to it
  React.useEffect(() => {
    if (initialSelectedRoom && initialSelectedRoom.polygon && initialSelectedRoom.polygon.length > 0) {
      // Calculate center of polygon
      const polygon = initialSelectedRoom.polygon;
      const centerLat = polygon.reduce((sum, p) => sum + p.lat, 0) / polygon.length;
      const centerLng = polygon.reduce((sum, p) => sum + p.lng, 0) / polygon.length;
      
      const newCenter = { lat: centerLat, lng: centerLng };
      setMapCenter(newCenter);
      setMapZoom(19);
      
      // Pan and zoom the map
      if (mapRef.current) {
        mapRef.current.panTo(newCenter);
        mapRef.current.setZoom(19);
      }
      
      // Set as selected to show info
      setSelectedRoom(initialSelectedRoom);
      setInfoPosition({ lat: centerLat + 0.0001, lng: centerLng + 0.0001 });
      
      console.log('📍 Zooming to room:', initialSelectedRoom.name, newCenter);
    }
  }, [initialSelectedRoom]);

  const center = mapCenter;

  const mapContainerStyle = {
    width: '100%',
    height: '600px'
  };

  // Function to get color based on temperature or door status
  const getPolygonColor = (room: Room) => {
    const isDoorOpen = room.sensors?.[0]?.additionalData?.magnet === 0;
    const temp = room.sensors?.[0]?.additionalData?.temperature || 0;

    if (isDoorOpen) return '#ef4444'; // red-500 - Door open (alert)
    if (temp < 5) return '#3b82f6'; // blue-500 - Very cold
    if (temp < 10) return '#10b981'; // green-500 - Normal cold
    if (temp < 15) return '#f59e0b'; // amber-500 - Warm
    return '#f97316'; // orange-500 - Hot
  };

  // Generate polygon coordinates for each room
  // Create a grid layout around the center point
  const generatePolygonCoordinates = (index: number) => {
    const cols = 4;
    const row = Math.floor(index / cols);
    const col = index % cols;
    
    // Size of each polygon (in degrees)
    const width = 0.002;
    const height = 0.001;
    const padding = 0.0005;
    
    // Calculate position
    const offsetX = (col - cols / 2) * (width + padding);
    const offsetY = (row - 2) * (height + padding);
    
    const baseLat = center.lat + offsetY;
    const baseLng = center.lng + offsetX;
    
    // Create rectangle polygon
    return [
      { lat: baseLat, lng: baseLng },
      { lat: baseLat, lng: baseLng + width },
      { lat: baseLat + height, lng: baseLng + width },
      { lat: baseLat + height, lng: baseLng },
    ];
  };

  // Google Maps API Key - configured in .env.local file
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';

  if (!apiKey) {
    return (
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-8">
        <div className="text-center">
          <svg className="w-16 h-16 mx-auto mb-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
          </svg>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Configuration Google Maps Requise</h3>
          <p className="text-sm text-gray-600 mb-4">
            Pour afficher la carte, ajoutez votre clé API Google Maps dans le fichier <code className="bg-gray-100 px-2 py-1 rounded text-xs">.env.local</code>
          </p>
          <div className="bg-gray-50 rounded-lg p-4 text-left max-w-md mx-auto">
            <code className="text-xs text-gray-700">
              VITE_GOOGLE_MAPS_API_KEY=votre_cle_api_ici
            </code>
          </div>
          <a 
            href="https://console.cloud.google.com/google/maps-apis" 
            target="_blank" 
            rel="noopener noreferrer"
            className="inline-flex items-center mt-4 text-sm text-blue-600 hover:text-blue-700 font-medium"
          >
            Obtenir une clé API Google Maps →
          </a>
        </div>
      </div>
    );
  }

  return (
    <LoadScript googleMapsApiKey={apiKey} libraries={GOOGLE_MAPS_LIBRARIES}>
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4 relative">
        <GoogleMap
          mapContainerStyle={mapContainerStyle}
          center={center}
          zoom={mapZoom}
          onLoad={(map) => { mapRef.current = map; }}
          options={{
            mapTypeId: 'satellite',
            mapTypeControl: true,
            streetViewControl: false,
            fullscreenControl: true,
            zoomControl: true,
          }}
        >
          {rooms.map((room, index) => {
            // Use saved polygon if available, otherwise generate default
            const paths = room.polygon && room.polygon.length > 0 
              ? room.polygon 
              : generatePolygonCoordinates(index);
            const color = getPolygonColor(room);
            const isDoorOpen = room.sensors?.[0]?.additionalData?.magnet === 0;
            const isSelected = selectedRoom?.id === room.id;

            return (
              <Polygon
                key={room.id}
                paths={paths}
                options={{
                  fillColor: color,
                  fillOpacity: isDoorOpen ? 0.7 : isSelected ? 0.8 : 0.5,
                  strokeColor: isSelected ? '#8b5cf6' : isDoorOpen ? '#dc2626' : '#1e293b',
                  strokeOpacity: 1,
                  strokeWeight: isSelected ? 4 : isDoorOpen ? 3 : 2,
                }}
                onClick={() => {
                  setSelectedRoom(room);
                  // Set info window position to center of polygon
                  const center = paths[0];
                  setInfoPosition({ lat: center.lat + 0.0005, lng: center.lng + 0.001 });
                }}
                onDblClick={() => onRoomClick(room)}
              />
            );
          })}

          {/* Info Window */}
          {selectedRoom && infoPosition && (
            <InfoWindow
              position={infoPosition}
              onCloseClick={() => {
                setSelectedRoom(null);
                setInfoPosition(null);
              }}
            >
              <div className="p-2 min-w-[200px]">
                <h3 className="font-bold text-gray-900 mb-2">{selectedRoom.name}</h3>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Température:</span>
                    <span className="font-semibold text-red-700">
                      {selectedRoom.sensors?.[0]?.additionalData?.temperature.toFixed(1)}°C
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Humidité:</span>
                    <span className="font-semibold text-blue-700">
                      {selectedRoom.sensors?.[0]?.additionalData?.humidity.toFixed(0)}%
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Porte:</span>
                    <span className={`font-semibold ${selectedRoom.sensors?.[0]?.additionalData?.magnet === 0 ? 'text-red-600' : 'text-green-600'}`}>
                      {selectedRoom.sensors?.[0]?.additionalData?.magnet === 0 ? 'Ouverte' : 'Fermée'}
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => onRoomClick(selectedRoom)}
                  className="mt-3 w-full px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Voir les détails
                </button>
              </div>
            </InfoWindow>
          )}
        </GoogleMap>

        {/* Legend */}
        <div className="absolute bottom-8 left-8 bg-white/95 backdrop-blur-sm rounded-xl p-4 shadow-lg border border-gray-200">
          <div className="text-sm font-bold text-gray-900 mb-3">Légende</div>
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 bg-blue-500 rounded-sm"></div>
              <span className="text-xs text-gray-700">&lt; 5°C</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 bg-green-500 rounded-sm"></div>
              <span className="text-xs text-gray-700">5-10°C</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 bg-amber-500 rounded-sm"></div>
              <span className="text-xs text-gray-700">10-15°C</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 bg-orange-500 rounded-sm"></div>
              <span className="text-xs text-gray-700">&gt; 15°C</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 bg-red-500 rounded-sm border-2 border-red-700"></div>
              <span className="text-xs font-semibold text-gray-900">Porte Ouverte</span>
            </div>
            <div className="flex items-center gap-2 pt-2 border-t border-gray-200">
              <div className="w-5 h-5 bg-gray-200 rounded-sm border-4 border-purple-500"></div>
              <span className="text-xs font-semibold text-purple-700">Sélectionné</span>
            </div>
          </div>
        </div>
      </div>
    </LoadScript>
  );
};

export default SensorsMapView;

