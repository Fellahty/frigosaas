import React, { useRef, useState, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Html } from '@react-three/drei';
import * as THREE from 'three';

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
  polygon?: Array<{ lat: number; lng: number }>;
}

interface Warehouse3DViewProps {
  rooms: Room[];
  selectedRoom?: Room | null;
  onRoomClick: (room: Room) => void;
}

// Individual room/chamber component
interface RoomBoxProps {
  room: Room;
  position: [number, number, number];
  isSelected: boolean;
  onClick: () => void;
  thermalMode?: boolean;
}

const RoomBox: React.FC<RoomBoxProps> = ({ room, position, isSelected, onClick, thermalMode = false }) => {
  const meshRef = useRef<THREE.Mesh>(null);
  const [hovered, setHovered] = useState(false);

  // Animate the box slightly
  useFrame((state) => {
    if (meshRef.current && (isSelected || hovered)) {
      meshRef.current.position.y = position[1] + Math.sin(state.clock.elapsedTime * 2) * 0.05;
    } else if (meshRef.current) {
      meshRef.current.position.y = position[1];
    }
  });

  // Get thermal camera colors (pure temperature gradient)
  const getThermalColor = (temp: number) => {
    // Thermal imaging gradient: violet → blue → cyan → green → yellow → orange → red
    if (temp < 0) return '#8b5cf6'; // Violet - Freezing
    if (temp < 3) return '#3b82f6'; // Blue - Very cold
    if (temp < 6) return '#06b6d4'; // Cyan - Cold
    if (temp < 9) return '#10b981'; // Green - Cool
    if (temp < 12) return '#eab308'; // Yellow - Normal
    if (temp < 15) return '#f97316'; // Orange - Warm
    return '#ef4444'; // Red - Hot
  };

  // Get modern light color based on temperature and door status
  const getColor = () => {
    const sensor = room.sensors?.[0];
    if (!sensor?.additionalData) return '#cbd5e1'; // Light gray for offline

    const isDoorOpen = sensor.additionalData.magnet === 0;
    const temp = sensor.additionalData.temperature;

    // Thermal mode: pure temperature gradient
    if (thermalMode) {
      return getThermalColor(temp);
    }

    // Normal mode: light modern colors
    if (isDoorOpen) return '#fda4af'; // Light rose - Door open (alert)
    if (temp < 5) return '#7dd3fc'; // Light sky blue - Very cold
    if (temp < 10) return '#5eead4'; // Light teal - Normal cold
    if (temp < 15) return '#fcd34d'; // Light yellow - Warm
    return '#fdba74'; // Light orange - Hot
  };

  const color = getColor();
  const sensor = room.sensors?.[0];
  const temp = sensor?.additionalData?.temperature;
  const humidity = sensor?.additionalData?.humidity;
  const isDoorOpen = sensor?.additionalData?.magnet === 0;

  // Larger chamber dimensions - Better presence
  const baseScale = 1.6 + (room.capacity / 10000) * 0.5;
  const width = 3.5 * baseScale; // Wider
  const height = 4; // Taller ceiling
  const depth = 4.5 * baseScale; // Deeper

  return (
    <group position={position}>
      {/* Floor of the room - Light modern */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -height / 2, 0]} receiveShadow>
        <planeGeometry args={[width, depth]} />
        <meshStandardMaterial color="#f1f5f9" metalness={0.3} roughness={0.7} />
      </mesh>

      {/* Main room interior - Changes based on view mode */}
      <mesh
        ref={meshRef}
        onClick={onClick}
        onPointerOver={() => setHovered(true)}
        onPointerOut={() => setHovered(false)}
        receiveShadow
      >
        <boxGeometry args={[width, height, depth]} />
        <meshStandardMaterial
          color={thermalMode ? color : "#ffffff"}
          emissive={color}
          emissiveIntensity={thermalMode ? 1.2 : (isSelected ? 0.9 : hovered ? 0.7 : isDoorOpen ? 0.8 : 0.5)}
          metalness={thermalMode ? 0.1 : 0.3}
          roughness={thermalMode ? 0.8 : 0.4}
          opacity={thermalMode ? 0.95 : 0.6}
          transparent
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Room walls - Hidden in thermal mode */}
      {!thermalMode && (
        <>
          {/* Back wall */}
          <mesh position={[0, 0, -depth / 2]} castShadow receiveShadow>
            <boxGeometry args={[width, height, 0.15]} />
            <meshStandardMaterial
              color="#ffffff"
              metalness={0.2}
              roughness={0.7}
              opacity={0.9}
              transparent
              emissive={color}
              emissiveIntensity={0.15}
            />
          </mesh>

          {/* Left wall */}
          <mesh position={[-width / 2, 0, 0]} castShadow receiveShadow>
            <boxGeometry args={[0.15, height, depth]} />
            <meshStandardMaterial
              color="#ffffff"
              metalness={0.2}
              roughness={0.7}
              opacity={0.9}
              transparent
              emissive={color}
              emissiveIntensity={0.15}
            />
          </mesh>

          {/* Right wall */}
          <mesh position={[width / 2, 0, 0]} castShadow receiveShadow>
            <boxGeometry args={[0.15, height, depth]} />
            <meshStandardMaterial
              color="#ffffff"
              metalness={0.2}
              roughness={0.7}
              opacity={0.9}
              transparent
              emissive={color}
              emissiveIntensity={0.15}
            />
          </mesh>

          {/* Ceiling/roof of room - Light modern panels */}
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, height / 2, 0]} receiveShadow>
            <planeGeometry args={[width, depth]} />
            <meshStandardMaterial
              color="#f8fafc"
              metalness={0.4}
              roughness={0.5}
              opacity={0.6}
              transparent
              emissive={color}
              emissiveIntensity={0.2}
            />
          </mesh>
        </>
      )}

      {/* Selection outline with glow */}
      {isSelected && (
        <mesh position={[0, 0, 0]}>
          <boxGeometry args={[width + 0.2, height + 0.2, depth + 0.2]} />
          <meshBasicMaterial color="#a78bfa" wireframe />
        </mesh>
      )}

      {/* Modern Smart Door System */}
      {isDoorOpen ? (
        <>
          {/* Open door - Modern glass with warning color */}
          <mesh position={[position[0] > 0 ? -width / 2 - 0.1 : width / 2 + 0.1, 0, depth / 3]} rotation={[0, position[0] > 0 ? -Math.PI / 3 : Math.PI / 3, 0]} castShadow>
            <boxGeometry args={[0.12, height * 0.85, depth * 0.7]} />
            <meshStandardMaterial 
              color="#fecdd3" 
              emissive="#fda4af" 
              emissiveIntensity={0.8} 
              metalness={0.6} 
              roughness={0.3}
              opacity={0.8}
              transparent
            />
          </mesh>
          {/* Warning LED strip on door edge */}
          <mesh position={[position[0] > 0 ? -width / 2 - 0.15 : width / 2 + 0.15, 0, depth / 3]}>
            <boxGeometry args={[0.03, height * 0.85, 0.05]} />
            <meshStandardMaterial color="#fbbf24" emissive="#fbbf24" emissiveIntensity={2} />
          </mesh>
          {/* Alarm light - Pulsing */}
          <mesh position={[position[0] > 0 ? -width / 2 - 0.2 : width / 2 + 0.2, height / 2 - 0.3, 0]}>
            <sphereGeometry args={[0.12, 16, 16]} />
            <meshStandardMaterial color="#fbbf24" emissive="#fbbf24" emissiveIntensity={2.5} />
          </mesh>
        </>
      ) : (
        <>
          {/* Closed door - Modern white/glass with metal frame */}
          <mesh position={[position[0] > 0 ? -width / 2 - 0.05 : width / 2 + 0.05, 0, 0]} castShadow receiveShadow>
            <boxGeometry args={[0.12, height * 0.85, depth * 0.7]} />
            <meshStandardMaterial 
              color="#f8fafc" 
              metalness={0.7} 
              roughness={0.2}
              emissive="#bae6fd"
              emissiveIntensity={0.2}
            />
          </mesh>
          {/* Door frame - Metallic accent */}
          <mesh position={[position[0] > 0 ? -width / 2 - 0.06 : width / 2 + 0.06, 0, 0]}>
            <boxGeometry args={[0.04, height * 0.9, depth * 0.75]} />
            <meshStandardMaterial color="#cbd5e1" metalness={0.85} roughness={0.15} />
          </mesh>
          {/* Modern handle - Chrome finish */}
          <mesh position={[position[0] > 0 ? -width / 2 - 0.13 : width / 2 + 0.13, 0.3, depth / 4]} castShadow>
            <cylinderGeometry args={[0.04, 0.04, 0.35, 16]} />
            <meshStandardMaterial 
              color="#e0e7ff" 
              metalness={0.95} 
              roughness={0.05}
              emissive="#a5f3fc"
              emissiveIntensity={0.3}
            />
          </mesh>
          {/* Status LED panel - Green secure */}
          <mesh position={[position[0] > 0 ? -width / 2 - 0.13 : width / 2 + 0.13, 0.8, 0]}>
            <boxGeometry args={[0.02, 0.15, 0.15]} />
            <meshStandardMaterial 
              color="#6ee7b7" 
              emissive="#10b981" 
              emissiveIntensity={1.2}
              metalness={0.5}
              roughness={0.3}
            />
          </mesh>
          {/* Digital lock indicator */}
          <mesh position={[position[0] > 0 ? -width / 2 - 0.13 : width / 2 + 0.13, 0.5, 0]}>
            <boxGeometry args={[0.02, 0.08, 0.08]} />
            <meshStandardMaterial 
              color="#7dd3fc" 
              emissive="#06b6d4" 
              emissiveIntensity={0.9}
            />
          </mesh>
        </>
      )}

      {/* Futuristic Holographic Display */}
      <Html position={[0, height / 2 + 0.5, 0]} center>
        <div className="flex flex-col items-center gap-0.5 pointer-events-none">
          {/* Holographic frame */}
          <div className="relative bg-gradient-to-br from-cyan-500/10 to-blue-500/10 backdrop-blur-sm border border-cyan-400/30 rounded-lg px-3 py-2">
            {/* Scanning line animation */}
            <div className="absolute inset-0 overflow-hidden rounded-lg">
              <div className="absolute w-full h-0.5 bg-gradient-to-r from-transparent via-cyan-400 to-transparent animate-pulse"></div>
            </div>
            
            {/* Room number */}
            <div className="text-lg font-bold text-slate-700 mb-0.5" style={{ 
              textShadow: '0 0 8px rgba(255,255,255,0.8)'
            }}>
              #{room.name.replace(/[^0-9]/g, '') || room.name}
            </div>
            
            {/* Temperature with trend */}
            {temp !== undefined && !isNaN(temp) && (
              <div className="flex items-center gap-1">
                <div className="text-base font-bold" style={{
                  color: temp < 5 ? '#0891b2' : temp < 10 ? '#14b8a6' : temp < 15 ? '#ca8a04' : '#ea580c',
                  textShadow: `0 0 6px rgba(255,255,255,0.9)`
                }}>
                  {temp.toFixed(1)}°C
                </div>
                {/* Temperature status icon */}
                <span className="text-xs">
                  {temp < 5 ? '❄️' : temp < 10 ? '✅' : temp < 15 ? '⚠️' : '🔥'}
                </span>
              </div>
            )}

            {/* Humidity bar */}
            {humidity !== undefined && !isNaN(humidity) && (
              <div className="flex items-center gap-1 mt-1">
                <div className="w-12 h-1 bg-slate-200 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-gradient-to-r from-cyan-400 to-blue-500 rounded-full"
                    style={{ width: `${Math.min(humidity, 100)}%` }}
                  ></div>
                </div>
                <span className="text-[10px] text-slate-600">{humidity.toFixed(0)}%</span>
              </div>
            )}

            {/* Status badge */}
            {isDoorOpen && (
              <div className="absolute -top-1 -right-1 w-3 h-3 bg-rose-500 rounded-full animate-ping" style={{
                boxShadow: '0 0 10px #f43f5e'
              }}></div>
            )}
          </div>
        </div>
      </Html>

      {/* Cold air particles effect for very cold rooms */}
      {temp !== undefined && temp < 3 && (
        <mesh position={[0, height / 4, 0]}>
          <sphereGeometry args={[0.05, 8, 8]} />
          <meshStandardMaterial 
            color="#7dd3fc" 
            emissive="#7dd3fc" 
            emissiveIntensity={1.5}
            transparent
            opacity={0.6}
          />
        </mesh>
      )}

      {/* Heat warning indicator for warm rooms */}
      {temp !== undefined && temp > 12 && (
        <mesh position={[0, height / 2 + 1.2, 0]}>
          <sphereGeometry args={[0.1, 16, 16]} />
          <meshStandardMaterial 
            color="#fbbf24" 
            emissive="#fbbf24" 
            emissiveIntensity={2}
          />
        </mesh>
      )}

      {/* Advanced Info Panel on Hover - Futuristic */}
      {hovered && sensor?.additionalData && (
        <Html position={[0, height / 2 + 1.5, 0]} center>
          <div className="bg-white/98 backdrop-blur-md rounded-xl p-3 shadow-2xl border-2 border-cyan-300 min-w-[220px]">
            {/* Header with scanning effect */}
            <div className="relative mb-2 pb-2 border-b border-cyan-200">
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-cyan-100 to-transparent opacity-50 animate-pulse"></div>
              <div className="font-bold text-cyan-700 text-sm flex items-center gap-2 relative">
                <div className="w-2 h-2 bg-cyan-500 rounded-full animate-pulse"></div>
                {room.name}
              </div>
            </div>
            
            {/* Data Grid */}
            <div className="grid grid-cols-2 gap-2 mb-2">
              {/* Temperature Card */}
              <div className="bg-gradient-to-br from-cyan-50 to-blue-50 rounded-lg p-2 border border-cyan-200">
                <div className="text-[9px] text-slate-600 mb-0.5">Température</div>
                <div className="text-lg font-bold text-cyan-700">
                  {temp !== undefined ? temp.toFixed(1) : '--'}°C
                </div>
                {/* Mini temperature gauge */}
                <div className="w-full h-1 bg-slate-200 rounded-full mt-1 overflow-hidden">
                  <div 
                    className={`h-full rounded-full ${
                      temp !== undefined && temp < 5 ? 'bg-cyan-500' : 
                      temp !== undefined && temp < 10 ? 'bg-teal-500' : 
                      temp !== undefined && temp < 15 ? 'bg-yellow-500' : 'bg-orange-500'
                    }`}
                    style={{ width: `${temp !== undefined ? Math.min((temp / 20) * 100, 100) : 0}%` }}
                  ></div>
                </div>
              </div>

              {/* Humidity Card */}
              <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg p-2 border border-blue-200">
                <div className="text-[9px] text-slate-600 mb-0.5">Humidité</div>
                <div className="text-lg font-bold text-blue-700">
                  {humidity !== undefined ? humidity.toFixed(0) : '--'}%
                </div>
                {/* Humidity gauge */}
                <div className="w-full h-1 bg-slate-200 rounded-full mt-1 overflow-hidden">
                  <div 
                    className="h-full bg-gradient-to-r from-blue-400 to-indigo-500 rounded-full"
                    style={{ width: `${humidity !== undefined ? Math.min(humidity, 100) : 0}%` }}
                  ></div>
                </div>
              </div>
            </div>

            {/* Status and Capacity */}
            <div className="grid grid-cols-2 gap-2">
              <div className={`rounded-lg p-2 text-center border ${
                isDoorOpen 
                  ? 'bg-rose-50 border-rose-300' 
                  : 'bg-emerald-50 border-emerald-300'
              }`}>
                <div className="text-[9px] text-slate-600">Porte</div>
                <div className={`text-xs font-bold ${isDoorOpen ? 'text-rose-700' : 'text-emerald-700'}`}>
                  {isDoorOpen ? '🚨 Ouverte' : '🔒 Fermée'}
                </div>
              </div>
              <div className="bg-gradient-to-br from-violet-50 to-purple-50 rounded-lg p-2 text-center border border-violet-200">
                <div className="text-[9px] text-slate-600">Groupe</div>
                <div className="text-xs font-bold text-violet-700">FRIGO {room.athGroupNumber || 1}</div>
              </div>
            </div>

            {/* Action hint */}
            <div className="mt-2 pt-2 border-t border-cyan-200 flex items-center justify-center gap-1">
              <div className="w-1 h-1 bg-cyan-500 rounded-full"></div>
              <span className="text-[10px] text-slate-500">Cliquez pour graphiques détaillés</span>
            </div>
          </div>
        </Html>
      )}
    </group>
  );
};

// Scanning radar effect component
const ScanningRadar: React.FC = () => {
  const radarRef = useRef<THREE.Mesh>(null);
  
  useFrame((state) => {
    if (radarRef.current) {
      // Rotate and pulse
      radarRef.current.rotation.y = state.clock.elapsedTime * 0.5;
      radarRef.current.position.y = 0.1 + Math.sin(state.clock.elapsedTime) * 0.05;
    }
  });

  return (
    <mesh ref={radarRef} position={[0, 0.1, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      <ringGeometry args={[0, 30, 64, 1, 0, Math.PI / 3]} />
      <meshStandardMaterial 
        color="#06b6d4" 
        emissive="#06b6d4" 
        emissiveIntensity={1.5}
        transparent
        opacity={0.3}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
};

// Main warehouse scene
const Warehouse3DView: React.FC<Warehouse3DViewProps> = ({ rooms, selectedRoom, onRoomClick }) => {
  const [internalSelectedRoom, setInternalSelectedRoom] = useState<Room | null>(selectedRoom || null);
  const [showThermalView, setShowThermalView] = useState(false);

  // Calculate positions - Spacious warehouse layout
  const roomPositions = useMemo(() => {
    const positions: Map<string, [number, number, number]> = new Map();
    
    // Spacious warehouse layout with better spacing
    const avgScale = 1.6 + (6000 / 10000) * 0.5;
    const roomWidth = 3.5 * avgScale;
    const roomDepth = 4.5 * avgScale;
    const aisleWidth = 6; // Wider central corridor
    const roomSpacing = roomDepth + 1.5; // More space between rooms
    
    rooms.forEach((room, index) => {
      // Alternate: left side, right side
      const isLeftSide = index % 2 === 0;
      
      // Position along the corridor (more compact)
      const roomIndexOnSide = Math.floor(index / 2);
      const z = (roomIndexOnSide * roomSpacing) - ((Math.ceil(rooms.length / 2)) * roomSpacing / 2);
      
      // Position across the corridor
      const x = isLeftSide 
        ? -(aisleWidth / 2 + roomWidth / 2)  // Left side
        : (aisleWidth / 2 + roomWidth / 2);   // Right side
      
      const y = 4 / 2; // Half height (center of room - updated for new height)
      
      positions.set(room.id, [x, y, z]);
    });

    return positions;
  }, [rooms]);

  const handleRoomClick = (room: Room) => {
    setInternalSelectedRoom(room);
    onRoomClick(room);
  };

  React.useEffect(() => {
    if (selectedRoom) {
      setInternalSelectedRoom(selectedRoom);
    }
  }, [selectedRoom]);

  return (
    <div className="bg-gradient-to-br from-slate-100 via-blue-50 to-cyan-50 rounded-2xl border border-slate-300 shadow-2xl overflow-hidden relative" style={{ height: 'calc(100vh - 280px)', minHeight: '500px' }}>
      <Canvas
        shadows
        camera={{ position: [0, 18, 50], fov: 65 }}
        gl={{ antialias: true }}
      >
        {/* Modern light environment */}
        <ambientLight intensity={0.8} color="#ffffff" />
        <directionalLight
          position={[0, 25, 10]}
          intensity={2}
          color="#ffffff"
          castShadow
          shadow-mapSize-width={2048}
          shadow-mapSize-height={2048}
        />
        {/* Soft accent lights - Pastel modern colors */}
        <pointLight position={[-10, 10, -10]} intensity={0.6} color="#7dd3fc" />
        <pointLight position={[10, 10, 10]} intensity={0.6} color="#a5f3fc" />
        <pointLight position={[0, 10, 0]} intensity={0.5} color="#bae6fd" />
        <pointLight position={[-10, 8, 10]} intensity={0.4} color="#5eead4" />
        <pointLight position={[10, 8, -10]} intensity={0.4} color="#99f6e4" />

        {/* Ground plane - Light modern floor */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
          <planeGeometry args={[100, 100]} />
          <meshStandardMaterial color="#e2e8f0" metalness={0.2} roughness={0.8} />
        </mesh>

        {/* Grid helper - Light modern grid */}
        <gridHelper args={[100, 50, '#cbd5e1', '#e2e8f0']} position={[0, 0.01, 0]} />

        {/* Scanning Radar Effect */}
        <ScanningRadar />

        {/* IoT Network Connections - Data flow visualization */}
        {rooms.slice(0, -1).map((room, index) => {
          const pos1 = roomPositions.get(room.id) || [0, 0, 0];
          const nextRoom = rooms[index + 1];
          const pos2 = roomPositions.get(nextRoom?.id || '') || [0, 0, 0];
          
          if (!nextRoom) return null;
          
          const distance = Math.sqrt(
            Math.pow(pos2[0] - pos1[0], 2) + 
            Math.pow(pos2[1] - pos1[1], 2) + 
            Math.pow(pos2[2] - pos1[2], 2)
          );
          
          const midX = (pos1[0] + pos2[0]) / 2;
          const midY = (pos1[1] + pos2[1]) / 2 + 2.5;
          const midZ = (pos1[2] + pos2[2]) / 2;
          
          // Calculate rotation to point from pos1 to pos2
          const dx = pos2[0] - pos1[0];
          const dy = pos2[1] - pos1[1];
          const dz = pos2[2] - pos1[2];
          const rotationY = Math.atan2(dx, dz);
          const rotationZ = Math.atan2(Math.sqrt(dx * dx + dz * dz), dy) - Math.PI / 2;
          
          return (
            <mesh 
              key={`connection-${index}`} 
              position={[midX, midY, midZ]}
              rotation={[0, rotationY, rotationZ]}
            >
              <cylinderGeometry args={[0.015, 0.015, distance, 8]} />
              <meshStandardMaterial 
                color="#7dd3fc" 
                emissive="#06b6d4" 
                emissiveIntensity={0.9}
                transparent
                opacity={0.5}
              />
            </mesh>
          );
        })}

        {/* Central corridor - Wide polished aisle */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]} receiveShadow>
          <planeGeometry args={[6, 80]} />
          <meshStandardMaterial 
            color="#f1f5f9" 
            metalness={0.5} 
            roughness={0.3}
            emissive="#bae6fd"
            emissiveIntensity={0.2}
          />
        </mesh>

        {/* Aisle edge lines - Modern cyan markings */}
        <mesh position={[-3, 0.03, 0]}>
          <boxGeometry args={[0.15, 0.02, 80]} />
          <meshStandardMaterial color="#06b6d4" emissive="#06b6d4" emissiveIntensity={0.7} />
        </mesh>
        <mesh position={[3, 0.03, 0]}>
          <boxGeometry args={[0.15, 0.02, 80]} />
          <meshStandardMaterial color="#06b6d4" emissive="#06b6d4" emissiveIntensity={0.7} />
        </mesh>

        {/* Center line - Teal guide */}
        <mesh position={[0, 0.04, 0]}>
          <boxGeometry args={[0.1, 0.01, 80]} />
          <meshStandardMaterial color="#14b8a6" emissive="#14b8a6" emissiveIntensity={0.6} />
        </mesh>

        {/* WAREHOUSE BUILDING STRUCTURE - Modern Light Glass */}
        {/* Left External Wall */}
        <mesh position={[-17, 4, 0]} receiveShadow castShadow>
          <boxGeometry args={[0.25, 8, 80]} />
          <meshStandardMaterial 
            color="#e0f2fe" 
            metalness={0.4} 
            roughness={0.3}
            opacity={0.5}
            transparent
            emissive="#bae6fd"
            emissiveIntensity={0.15}
          />
        </mesh>

        {/* Right External Wall */}
        <mesh position={[17, 4, 0]} receiveShadow castShadow>
          <boxGeometry args={[0.25, 8, 80]} />
          <meshStandardMaterial 
            color="#e0f2fe" 
            metalness={0.4} 
            roughness={0.3}
            opacity={0.5}
            transparent
            emissive="#bae6fd"
            emissiveIntensity={0.15}
          />
        </mesh>

        {/* Back Wall */}
        <mesh position={[0, 4, -40]} receiveShadow castShadow>
          <boxGeometry args={[34, 8, 0.25]} />
          <meshStandardMaterial 
            color="#e0f2fe" 
            metalness={0.4} 
            roughness={0.3}
            opacity={0.5}
            transparent
            emissive="#bae6fd"
            emissiveIntensity={0.15}
          />
        </mesh>

        {/* Front Wall (with large opening) */}
        <mesh position={[-13, 4, 40]} receiveShadow castShadow>
          <boxGeometry args={[8, 8, 0.25]} />
          <meshStandardMaterial 
            color="#e0f2fe" 
            metalness={0.4} 
            roughness={0.3}
            opacity={0.5}
            transparent
            emissive="#bae6fd"
            emissiveIntensity={0.15}
          />
        </mesh>
        <mesh position={[13, 4, 40]} receiveShadow castShadow>
          <boxGeometry args={[8, 8, 0.25]} />
          <meshStandardMaterial 
            color="#e0f2fe" 
            metalness={0.4} 
            roughness={0.3}
            opacity={0.5}
            transparent
            emissive="#bae6fd"
            emissiveIntensity={0.15}
          />
        </mesh>

        {/* Roof Structure - V Inversé - Modern Glass Left Side */}
        <mesh rotation={[0, 0, Math.PI / 5.5]} position={[-8.5, 10, 0]} receiveShadow castShadow>
          <boxGeometry args={[22, 0.2, 80.4]} />
          <meshStandardMaterial 
            color="#f0f9ff" 
            metalness={0.6} 
            roughness={0.2}
            opacity={0.4}
            transparent
            emissive="#7dd3fc"
            emissiveIntensity={0.3}
          />
        </mesh>

        {/* Roof Structure - V Inversé - Right Side */}
        <mesh rotation={[0, 0, -Math.PI / 5.5]} position={[8.5, 10, 0]} receiveShadow castShadow>
          <boxGeometry args={[22, 0.2, 80.4]} />
          <meshStandardMaterial 
            color="#f0f9ff" 
            metalness={0.6} 
            roughness={0.2}
            opacity={0.4}
            transparent
            emissive="#7dd3fc"
            emissiveIntensity={0.3}
          />
        </mesh>

        {/* Ridge beam at top - Modern metallic */}
        <mesh position={[0, 14, 0]} castShadow>
          <boxGeometry args={[0.3, 0.3, 80.4]} />
          <meshStandardMaterial 
            color="#bae6fd" 
            metalness={0.9} 
            roughness={0.1}
            emissive="#7dd3fc"
            emissiveIntensity={0.6}
          />
        </mesh>

        {/* Roof Support Beams - Modern Light Metal */}
        {[-35, -30, -25, -20, -15, -10, -5, 0, 5, 10, 15, 20, 25, 30, 35].map((z) => (
          <group key={`beam-group-${z}`}>
            {/* Left roof beam */}
            <mesh position={[-8.5, 10, z]} rotation={[0, 0, Math.PI / 5.5]} castShadow>
              <boxGeometry args={[22, 0.12, 0.2]} />
              <meshStandardMaterial 
                color="#bae6fd" 
                metalness={0.85} 
                roughness={0.15} 
                emissive="#7dd3fc" 
                emissiveIntensity={0.25}
              />
            </mesh>
            {/* Right roof beam */}
            <mesh position={[8.5, 10, z]} rotation={[0, 0, -Math.PI / 5.5]} castShadow>
              <boxGeometry args={[22, 0.12, 0.2]} />
              <meshStandardMaterial 
                color="#bae6fd" 
                metalness={0.85} 
                roughness={0.15} 
                emissive="#7dd3fc" 
                emissiveIntensity={0.25}
              />
            </mesh>
          </group>
        ))}

        {/* Support Columns - Modern Light Metal */}
        {[
          [-16.5, -38],
          [16.5, -38],
          [-16.5, -30],
          [16.5, -30],
          [-16.5, -22],
          [16.5, -22],
          [-16.5, -14],
          [16.5, -14],
          [-16.5, -6],
          [16.5, -6],
          [-16.5, 2],
          [16.5, 2],
          [-16.5, 10],
          [16.5, 10],
          [-16.5, 18],
          [16.5, 18],
          [-16.5, 26],
          [16.5, 26],
          [-16.5, 34],
          [16.5, 34],
          [-16.5, 38],
          [16.5, 38],
        ].map(([x, z], i) => (
          <mesh key={`column-${i}`} position={[x, 4, z]} castShadow>
            <cylinderGeometry args={[0.3, 0.3, 8, 12]} />
            <meshStandardMaterial 
              color="#cbd5e1" 
              metalness={0.8} 
              roughness={0.2}
              emissive="#7dd3fc"
              emissiveIntensity={0.3}
            />
          </mesh>
        ))}

        {/* Warehouse Sign - Modern light panel */}
        <mesh position={[0, 7, 40.1]} receiveShadow>
          <boxGeometry args={[20, 3, 0.15]} />
          <meshStandardMaterial 
            color="#bae6fd" 
            metalness={0.6} 
            roughness={0.3}
            emissive="#7dd3fc"
            emissiveIntensity={0.6}
          />
        </mesh>

        {/* Room boxes */}
        {rooms.map((room) => {
          const position = roomPositions.get(room.id) || [0, 0, 0];
          return (
            <RoomBox
              key={room.id}
              room={room}
              position={position}
              isSelected={internalSelectedRoom?.id === room.id}
              onClick={() => handleRoomClick(room)}
              thermalMode={showThermalView}
            />
          );
        })}

        {/* Warehouse title - Modern */}
        <Html position={[0, 12, -38]} center>
          <div className="text-3xl font-bold text-cyan-600 pointer-events-none" style={{
            textShadow: '0 0 10px #7dd3fc, 1px 1px 3px rgba(0,0,0,0.3)',
            letterSpacing: '3px'
          }}>
            ENTREPÔT FRIGORIFIQUE
          </div>
        </Html>

        {/* Camera controls - Optimized for spacious warehouse */}
        <OrbitControls
          enablePan
          enableZoom
          enableRotate
          minDistance={20}
          maxDistance={90}
          maxPolarAngle={Math.PI / 2.2}
          target={[0, 4, 0]}
          enableDamping
          dampingFactor={0.05}
        />

        {/* Fog for depth - Light modern */}
        <fog attach="fog" args={['#e0f2fe', 40, 100]} />
      </Canvas>

      {/* Legend overlay - Modern Light */}
      <div className="absolute bottom-3 left-3 md:bottom-6 md:left-6 bg-white/95 backdrop-blur-md rounded-xl p-3 md:p-4 shadow-2xl border border-cyan-200 max-w-[180px] md:max-w-xs">
        <div className="text-xs md:text-sm font-bold text-cyan-600 mb-2 md:mb-3 flex items-center gap-1 md:gap-2">
          <div className="w-2 h-2 bg-cyan-500 rounded-full animate-pulse"></div>
          <span className="hidden md:inline">Légende</span>
          <span className="md:hidden">Temp</span>
        </div>
        <div className="space-y-1 md:space-y-1.5">
          <div className="flex items-center gap-1.5 md:gap-2">
            <div className="w-4 h-4 md:w-5 md:h-5 rounded-sm shadow-lg flex-shrink-0" style={{ backgroundColor: '#7dd3fc', boxShadow: '0 0 10px #7dd3fc' }}></div>
            <span className="text-[10px] md:text-xs text-cyan-700 font-medium">&lt; 5°C</span>
          </div>
          <div className="flex items-center gap-1.5 md:gap-2">
            <div className="w-4 h-4 md:w-5 md:h-5 rounded-sm shadow-lg flex-shrink-0" style={{ backgroundColor: '#5eead4', boxShadow: '0 0 10px #5eead4' }}></div>
            <span className="text-[10px] md:text-xs text-teal-700 font-medium">5-10°C</span>
          </div>
          <div className="flex items-center gap-1.5 md:gap-2">
            <div className="w-4 h-4 md:w-5 md:h-5 rounded-sm shadow-lg flex-shrink-0" style={{ backgroundColor: '#fcd34d', boxShadow: '0 0 10px #fcd34d' }}></div>
            <span className="text-[10px] md:text-xs text-yellow-700 font-medium">10-15°C</span>
          </div>
          <div className="flex items-center gap-1.5 md:gap-2">
            <div className="w-4 h-4 md:w-5 md:h-5 rounded-sm shadow-lg flex-shrink-0" style={{ backgroundColor: '#fdba74', boxShadow: '0 0 10px #fdba74' }}></div>
            <span className="text-[10px] md:text-xs text-orange-700 font-medium">&gt; 15°C</span>
          </div>
          <div className="flex items-center gap-1.5 md:gap-2">
            <div className="w-4 h-4 md:w-5 md:h-5 rounded-sm shadow-lg flex-shrink-0" style={{ backgroundColor: '#fda4af', boxShadow: '0 0 15px #fda4af' }}></div>
            <span className="text-[10px] md:text-xs font-bold text-rose-700">🚨 Porte ouverte</span>
          </div>
        </div>
      </div>

      {/* Advanced Control Panel */}
      <div className="absolute top-3 left-3 md:top-6 md:left-6 bg-white/95 backdrop-blur-md rounded-xl p-3 md:p-4 shadow-2xl border border-cyan-200">
        <div className="text-xs md:text-sm font-bold text-cyan-600 mb-1.5 md:mb-2 flex items-center gap-1">
          <div className="w-2 h-2 bg-cyan-500 rounded-full animate-pulse"></div>
          Monitoring Live
        </div>
        
        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-2 mb-2">
          <div className="bg-gradient-to-br from-cyan-50 to-blue-50 rounded-lg p-2 border border-cyan-200">
            <div className="text-[10px] text-slate-600">Total</div>
            <div className="text-lg font-bold text-cyan-600">{rooms.length}</div>
          </div>
          <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg p-2 border border-blue-200">
            <div className="text-[10px] text-slate-600">Moy. T°</div>
            <div className="text-lg font-bold text-blue-600">
              {(rooms.reduce((sum, r) => sum + (r.sensors?.[0]?.additionalData?.temperature || 0), 0) / rooms.length).toFixed(1)}°
            </div>
          </div>
          <div className="bg-gradient-to-br from-emerald-50 to-teal-50 rounded-lg p-2 border border-emerald-200">
            <div className="text-[10px] text-slate-600">OK</div>
            <div className="text-lg font-bold text-emerald-600">
              {rooms.filter((r) => r.sensors?.[0]?.additionalData?.magnet !== 0 && (r.sensors?.[0]?.additionalData?.temperature || 0) < 10).length}
            </div>
          </div>
          <div className="bg-gradient-to-br from-rose-50 to-pink-50 rounded-lg p-2 border border-rose-200">
            <div className="text-[10px] text-slate-600">Alertes</div>
            <div className="text-lg font-bold text-rose-600">
              {rooms.filter((r) => r.sensors?.[0]?.additionalData?.magnet === 0).length}
            </div>
          </div>
        </div>

        {/* Thermal View Toggle */}
        <button
          onClick={() => setShowThermalView(!showThermalView)}
          className={`w-full py-1.5 px-3 rounded-lg text-xs font-medium transition-all ${
            showThermalView 
              ? 'bg-gradient-to-r from-orange-500 to-red-500 text-white shadow-lg' 
              : 'bg-gradient-to-r from-cyan-100 to-blue-100 text-cyan-700 hover:from-cyan-200 hover:to-blue-200'
          }`}
        >
          {showThermalView ? '🌡️ Vision Thermique ON' : '🔍 Vision Normale'}
        </button>
      </div>

      {/* Thermal View Indicator & Scale */}
      {showThermalView && (
        <div className="absolute top-3 right-3 md:top-6 md:right-6 bg-gradient-to-br from-gray-900/98 to-black/98 backdrop-blur-md rounded-xl p-4 shadow-2xl border-2 border-orange-400">
          <div className="text-sm font-bold text-white flex items-center gap-2 mb-3">
            <div className="w-2 h-2 bg-orange-400 rounded-full animate-pulse"></div>
            MODE THERMIQUE
          </div>
          
          {/* Thermal gradient scale */}
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <div className="w-6 h-3 rounded" style={{ background: 'linear-gradient(to right, #8b5cf6, #3b82f6, #06b6d4, #10b981, #eab308, #f97316, #ef4444)' }}></div>
              <span className="text-xs text-white">Échelle</span>
            </div>
            <div className="flex justify-between text-[10px] text-gray-300">
              <span>❄️ 0°C</span>
              <span>🔥 15°C</span>
            </div>
            <div className="space-y-1 text-[10px] mt-2">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: '#8b5cf6' }}></div>
                <span className="text-violet-300">Glacial &lt; 0°</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: '#3b82f6' }}></div>
                <span className="text-blue-300">Très froid 0-3°</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: '#06b6d4' }}></div>
                <span className="text-cyan-300">Froid 3-6°</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: '#10b981' }}></div>
                <span className="text-emerald-300">Frais 6-9°</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: '#eab308' }}></div>
                <span className="text-yellow-300">Normal 9-12°</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: '#f97316' }}></div>
                <span className="text-orange-300">Chaud 12-15°</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: '#ef4444' }}></div>
                <span className="text-red-300">Très chaud &gt; 15°</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Warehouse3DView;

