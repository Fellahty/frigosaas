import React, { useState, useCallback, useRef } from 'react';
import { GoogleMap, LoadScript, Polygon, Autocomplete, Marker, Polyline } from '@react-google-maps/api';

// Define libraries as a constant to avoid re-creating the array
const GOOGLE_MAPS_LIBRARIES: ("places")[] = ['places'];

interface PolygonEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  roomName: string;
  initialPolygon?: Array<{ lat: number; lng: number }>;
  onSave: (polygon: Array<{ lat: number; lng: number }>) => void;
}

const PolygonEditorModal: React.FC<PolygonEditorModalProps> = ({
  isOpen,
  onClose,
  roomName,
  initialPolygon,
  onSave
}) => {
  const [polygon, setPolygon] = useState<Array<{ lat: number; lng: number }>>([]);
  const [isDrawing, setIsDrawing] = useState(false);
  const [mapCenter, setMapCenter] = useState({ lat: 33.5731, lng: -7.5898 });
  const [mapZoom, setMapZoom] = useState(18);
  const [searchedLocation, setSearchedLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [autocomplete, setAutocomplete] = useState<google.maps.places.Autocomplete | null>(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [drawingPoints, setDrawingPoints] = useState<Array<{ lat: number; lng: number }>>([]);
  const mapRef = useRef<google.maps.Map | null>(null);
  const polygonRef = useRef<google.maps.Polygon | null>(null);

  // When modal opens, load existing polygon or start fresh
  React.useEffect(() => {
    if (initialPolygon && initialPolygon.length > 0 && isOpen) {
      console.log('📍 Modal opened with polygon:', initialPolygon);
      
      // Set the polygon state immediately
      setPolygon(initialPolygon);
      
      // Calculate center of polygon
      const centerLat = initialPolygon.reduce((sum, p) => sum + p.lat, 0) / initialPolygon.length;
      const centerLng = initialPolygon.reduce((sum, p) => sum + p.lng, 0) / initialPolygon.length;
      
      const newCenter = { lat: centerLat, lng: centerLng };
      setMapCenter(newCenter);
      setMapZoom(20);
      
      console.log('📍 Set map center:', newCenter);
    } else if (isOpen && (!initialPolygon || initialPolygon.length === 0)) {
      // Reset for new polygon
      setPolygon([]);
      setDrawingPoints([]);
      setMapZoom(18);
    }
  }, [isOpen, initialPolygon]);

  const center = mapCenter;

  const mapContainerStyle = {
    width: '100%',
    height: '500px'
  };

  const handleMapClick = useCallback((e: google.maps.MapMouseEvent) => {
    if (!isDrawing || !e.latLng) return;
    
    const newPoint = {
      lat: e.latLng.lat(),
      lng: e.latLng.lng()
    };
    
    setDrawingPoints(prev => [...prev, newPoint]);
    console.log('📍 Point added:', newPoint, 'Total points:', drawingPoints.length + 1);
  }, [isDrawing, drawingPoints]);

  const handleFinishDrawing = useCallback(() => {
    if (drawingPoints.length >= 3) {
      setPolygon(drawingPoints);
      setDrawingPoints([]);
      setIsDrawing(false);
      console.log('✅ Polygon completed with', drawingPoints.length, 'points');
    } else {
      alert('Vous devez placer au moins 3 points pour créer un polygone');
    }
  }, [drawingPoints]);

  const handlePolygonEdit = useCallback((editedPolygon: google.maps.Polygon) => {
    const path = editedPolygon.getPath();
    const coordinates: Array<{ lat: number; lng: number }> = [];
    
    for (let i = 0; i < path.getLength(); i++) {
      const point = path.getAt(i);
      coordinates.push({
        lat: point.lat(),
        lng: point.lng()
      });
    }
    
    setPolygon(coordinates);
    console.log('✏️ Polygon edited:', coordinates);
  }, []);

  const handleSave = () => {
    if (polygon.length < 3) {
      alert('Le polygone doit avoir au moins 3 points');
      return;
    }
    onSave(polygon);
    onClose();
  };

  const handleClear = () => {
    setPolygon([]);
    setDrawingPoints([]);
    polygonRef.current = null;
    console.log('🗑️ Polygon cleared, ready to draw new one');
  };

  const handleStartDrawing = () => {
    setIsDrawing(true);
    setDrawingPoints([]);
    console.log('🖊️ Started drawing mode - click on map to add points');
  };

  const onLoad = useCallback((autocompleteInstance: google.maps.places.Autocomplete) => {
    setAutocomplete(autocompleteInstance);
  }, []);

  const onPlaceChanged = useCallback(() => {
    if (autocomplete) {
      const place = autocomplete.getPlace();
      if (place.geometry && place.geometry.location) {
        const newLocation = {
          lat: place.geometry.location.lat(),
          lng: place.geometry.location.lng()
        };
        setMapCenter(newLocation);
        setMapZoom(19);
        setSearchedLocation(newLocation);
        
        // Pan and zoom the map to the location
        if (mapRef.current) {
          mapRef.current.panTo(newLocation);
          mapRef.current.setZoom(19);
        }
        
        console.log('📍 Location found:', place.formatted_address, newLocation);
      }
    }
  }, [autocomplete]);

  const handleClearSearch = () => {
    setSearchedLocation(null);
  };

  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';

  if (!isOpen) return null;

  if (!apiKey) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Configuration Requise</h3>
          <p className="text-sm text-gray-600 mb-4">
            Veuillez configurer la clé API Google Maps dans le fichier .env.local
          </p>
          <button
            onClick={onClose}
            className="w-full px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
          >
            Fermer
          </button>
        </div>
      </div>
    );
  }

  return (
    <LoadScript googleMapsApiKey={apiKey} libraries={GOOGLE_MAPS_LIBRARIES}>
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-2xl shadow-xl max-w-5xl w-full max-h-[90vh] overflow-hidden flex flex-col">
          {/* Header */}
          <div className="px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-slate-50 to-gray-50">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-gray-900">
                  {initialPolygon && initialPolygon.length > 0 ? 'Modifier le Polygone' : 'Dessiner le Polygone'}
                </h2>
                <p className="text-sm text-gray-600 mt-1">
                  {roomName}
                  {initialPolygon && initialPolygon.length > 0 && (
                    <span className="ml-2 text-green-600 font-medium">• Polygone existant ({initialPolygon.length} points)</span>
                  )}
                </p>
              </div>
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          {/* Search Box */}
          <div className="px-6 py-3 bg-white border-b border-gray-200">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <div className="flex-1 relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                  </div>
                  <Autocomplete
                    onLoad={onLoad}
                    onPlaceChanged={onPlaceChanged}
                  >
                    <input
                      type="text"
                      placeholder="Rechercher une adresse ou lieu..."
                      className="w-full pl-10 pr-10 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                    />
                  </Autocomplete>
                  {searchedLocation && (
                    <button
                      onClick={handleClearSearch}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center"
                      title="Effacer la recherche"
                    >
                      <svg className="w-4 h-4 text-gray-400 hover:text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  )}
                </div>
              </div>
              {searchedLocation && (
                <div className="flex items-center gap-2 text-xs text-green-700 bg-green-50 px-3 py-2 rounded-lg">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="font-medium">Localisation trouvée - Vous pouvez maintenant dessiner le polygone</span>
                </div>
              )}
            </div>
          </div>

          {/* Map */}
          <div className="flex-1 p-4 overflow-auto">
            <GoogleMap
              mapContainerStyle={mapContainerStyle}
              center={center}
              zoom={mapZoom}
              onLoad={(map) => { 
                mapRef.current = map;
                setMapLoaded(true);
                console.log('🗺️ Map loaded successfully');
                
                // If we have a polygon, center on it
                if (polygon.length > 0) {
                  const centerLat = polygon.reduce((sum, p) => sum + p.lat, 0) / polygon.length;
                  const centerLng = polygon.reduce((sum, p) => sum + p.lng, 0) / polygon.length;
                  setTimeout(() => {
                    map.panTo({ lat: centerLat, lng: centerLng });
                    map.setZoom(20);
                    console.log('📍 Map centered on polygon after load');
                  }, 300);
                }
              }}
              onClick={handleMapClick}
              options={{
                mapTypeId: 'satellite',
                mapTypeControl: true,
                streetViewControl: false,
                fullscreenControl: false,
                zoomControl: true,
                clickableIcons: false,
              }}
            >
              {/* Marker for searched location */}
              {searchedLocation && (
                <Marker
                  position={searchedLocation}
                  icon={{
                    path: google.maps.SymbolPath.CIRCLE,
                    scale: 8,
                    fillColor: '#ef4444',
                    fillOpacity: 0.8,
                    strokeColor: '#fff',
                    strokeWeight: 2,
                  }}
                  animation={google.maps.Animation.DROP}
                />
              )}

              {/* Show existing polygon - EDITABLE - Always render if polygon exists */}
              {polygon.length > 0 && !isDrawing && (
                <>
                  <Polygon
                    key={`polygon-edit-${polygon.length}`}
                    paths={polygon}
                    onLoad={(polygonInstance) => {
                      polygonRef.current = polygonInstance;
                      console.log('✅ Polygon loaded on map with', polygon.length, 'points');
                    }}
                    onMouseUp={() => {
                      if (polygonRef.current) {
                        handlePolygonEdit(polygonRef.current);
                      }
                    }}
                    onDragEnd={() => {
                      if (polygonRef.current) {
                        handlePolygonEdit(polygonRef.current);
                      }
                    }}
                    options={{
                      fillColor: '#10b981',
                      fillOpacity: 0.7,
                      strokeColor: '#059669',
                      strokeOpacity: 1,
                      strokeWeight: 4,
                      editable: true,
                      draggable: true,
                      clickable: false,
                    }}
                  />
                  
                  {/* Visual markers at each polygon point - BIG and VISIBLE */}
                  {polygon.map((point, idx) => (
                    <Marker
                      key={`poly-marker-${idx}`}
                      position={point}
                      icon={{
                        path: google.maps.SymbolPath.CIRCLE,
                        scale: 10,
                        fillColor: '#10b981',
                        fillOpacity: 1,
                        strokeColor: '#fff',
                        strokeWeight: 3,
                      }}
                      label={{
                        text: `${idx + 1}`,
                        color: 'white',
                        fontSize: '14px',
                        fontWeight: 'bold'
                      }}
                      title={`Point ${idx + 1}: ${point.lat.toFixed(6)}, ${point.lng.toFixed(6)}`}
                    />
                  ))}
                </>
              )}

              {/* Drawing Mode - Show points being placed */}
              {isDrawing && drawingPoints.length > 0 && (
                <>
                  {/* Show markers for each point */}
                  {drawingPoints.map((point, idx) => (
                    <Marker
                      key={`drawing-point-${idx}`}
                      position={point}
                      label={{
                        text: `${idx + 1}`,
                        color: 'white',
                        fontSize: '12px',
                        fontWeight: 'bold'
                      }}
                      icon={{
                        path: google.maps.SymbolPath.CIRCLE,
                        scale: 8,
                        fillColor: '#3b82f6',
                        fillOpacity: 1,
                        strokeColor: '#fff',
                        strokeWeight: 2,
                      }}
                    />
                  ))}
                  
                  {/* Show line connecting points */}
                  {drawingPoints.length > 1 && (
                    <Polyline
                      path={drawingPoints}
                      options={{
                        strokeColor: '#3b82f6',
                        strokeOpacity: 0.8,
                        strokeWeight: 3,
                      }}
                    />
                  )}
                  
                  {/* Show preview polygon if 3+ points */}
                  {drawingPoints.length >= 3 && (
                    <Polygon
                      paths={drawingPoints}
                      options={{
                        fillColor: '#3b82f6',
                        fillOpacity: 0.3,
                        strokeColor: '#1e40af',
                        strokeOpacity: 0.8,
                        strokeWeight: 2,
                        editable: false,
                        draggable: false,
                      }}
                    />
                  )}
                </>
              )}
            </GoogleMap>
          </div>

        {/* Footer Actions */}
        <div className="px-4 py-3 border-t border-gray-200 bg-gray-50 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            {isDrawing ? (
              <>
                <span className="text-xs font-medium text-blue-700 bg-blue-50 px-2 py-1 rounded border border-blue-200">
                  ✏️ {drawingPoints.length} pts placés
                </span>
                <button
                  onClick={handleFinishDrawing}
                  disabled={drawingPoints.length < 3}
                  className="px-3 py-1.5 bg-green-600 text-white rounded text-xs font-medium hover:bg-green-700 transition-colors disabled:bg-gray-300"
                >
                  ✓ Terminer
                </button>
                <button
                  onClick={() => {
                    setIsDrawing(false);
                    setDrawingPoints([]);
                  }}
                  className="px-3 py-1.5 bg-gray-200 text-gray-700 rounded text-xs font-medium hover:bg-gray-300"
                >
                  ✕ Annuler
                </button>
              </>
            ) : polygon.length > 0 ? (
              <>
                <span className="text-xs font-medium text-green-700 bg-green-50 px-2 py-1 rounded border border-green-200">
                  ✓ {polygon.length} pts
                </span>
                <button
                  onClick={handleClear}
                  className="px-3 py-1.5 bg-red-50 text-red-700 rounded text-xs font-medium hover:bg-red-100 transition-colors border border-red-200"
                >
                  🗑️ Effacer
                </button>
              </>
            ) : (
              <button
                onClick={handleStartDrawing}
                className="px-3 py-1.5 bg-blue-600 text-white rounded text-xs font-medium hover:bg-blue-700 transition-colors"
              >
                🖊️ Dessiner
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-3 py-1.5 bg-gray-200 text-gray-700 rounded text-xs font-medium hover:bg-gray-300 transition-colors"
            >
              Annuler
            </button>
            <button
              onClick={handleSave}
              disabled={polygon.length < 3}
              className="px-4 py-1.5 bg-green-600 text-white rounded text-xs font-medium hover:bg-green-700 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
            >
              💾 Enregistrer
            </button>
          </div>
        </div>
        </div>
      </div>
    </LoadScript>
  );
};

export default PolygonEditorModal;

