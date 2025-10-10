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
}

const RoomBox: React.FC<RoomBoxProps> = ({ room, position, isSelected, onClick }) => {
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

  // Get modern light color based on temperature and door status
  const getColor = () => {
    const sensor = room.sensors?.[0];
    if (!sensor?.additionalData) return '#cbd5e1'; // Light gray for offline

    const isDoorOpen = sensor.additionalData.magnet === 0;
    const temp = sensor.additionalData.temperature;

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

  // Compact chamber dimensions - Optimized for viewing
  const baseScale = 1.3 + (room.capacity / 10000) * 0.4;
  const width = 2.8 * baseScale; // Compact width
  const height = 3.5; // Standard ceiling height (fixed)
  const depth = 3.5 * baseScale; // Compact depth

  return (
    <group position={position}>
      {/* Floor of the room - Light modern */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -height / 2, 0]} receiveShadow>
        <planeGeometry args={[width, depth]} />
        <meshStandardMaterial color="#f1f5f9" metalness={0.3} roughness={0.7} />
      </mesh>

      {/* Main room interior - Light modern with colored glow */}
      <mesh
        ref={meshRef}
        onClick={onClick}
        onPointerOver={() => setHovered(true)}
        onPointerOut={() => setHovered(false)}
        receiveShadow
      >
        <boxGeometry args={[width, height, depth]} />
        <meshStandardMaterial
          color="#ffffff"
          emissive={color}
          emissiveIntensity={isSelected ? 0.9 : hovered ? 0.7 : isDoorOpen ? 0.8 : 0.5}
          metalness={0.3}
          roughness={0.4}
          opacity={0.6}
          transparent
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Room walls - Clean white modern */}
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

      {/* Selection outline with glow */}
      {isSelected && (
        <mesh position={[0, 0, 0]}>
          <boxGeometry args={[width + 0.2, height + 0.2, depth + 0.2]} />
          <meshBasicMaterial color="#a78bfa" wireframe />
        </mesh>
      )}

      {/* Door facing corridor - on the side facing the aisle */}
      {isDoorOpen ? (
        <>
          {/* Open door swung outward */}
          <mesh position={[position[0] > 0 ? -width / 2 - 0.1 : width / 2 + 0.1, 0, depth / 3]} rotation={[0, position[0] > 0 ? -Math.PI / 3 : Math.PI / 3, 0]} castShadow>
            <boxGeometry args={[0.12, height * 0.85, depth * 0.7]} />
            <meshStandardMaterial 
              color="#dc2626" 
              emissive="#dc2626" 
              emissiveIntensity={0.7} 
              metalness={0.5} 
              roughness={0.5}
            />
          </mesh>
          {/* Alarm light above door */}
          <mesh position={[position[0] > 0 ? -width / 2 - 0.15 : width / 2 + 0.15, height / 2 - 0.2, 0]}>
            <sphereGeometry args={[0.15, 16, 16]} />
            <meshStandardMaterial color="#fbbf24" emissive="#fbbf24" emissiveIntensity={2} />
          </mesh>
        </>
      ) : (
        <>
          {/* Closed door facing corridor - metal insulated */}
          <mesh position={[position[0] > 0 ? -width / 2 - 0.05 : width / 2 + 0.05, 0, 0]} castShadow receiveShadow>
            <boxGeometry args={[0.12, height * 0.85, depth * 0.7]} />
            <meshStandardMaterial 
              color="#475569" 
              metalness={0.7} 
              roughness={0.3}
            />
          </mesh>
          {/* Door handle */}
          <mesh position={[position[0] > 0 ? -width / 2 - 0.1 : width / 2 + 0.1, 0.3, depth / 4]} castShadow>
            <cylinderGeometry args={[0.05, 0.05, 0.3, 12]} />
            <meshStandardMaterial color="#94a3b8" metalness={0.95} roughness={0.05} />
          </mesh>
          {/* Door lock indicator - green when closed */}
          <mesh position={[position[0] > 0 ? -width / 2 - 0.12 : width / 2 + 0.12, 0.8, 0]}>
            <sphereGeometry args={[0.08, 16, 16]} />
            <meshStandardMaterial color="#10b981" emissive="#10b981" emissiveIntensity={0.8} />
          </mesh>
        </>
      )}

      {/* Compact modern text display */}
      <Html position={[0, height / 2 + 0.5, 0]} center>
        <div className="flex flex-col items-center gap-0.5 pointer-events-none">
          {/* Room number */}
          <div className="text-lg font-bold text-slate-700" style={{ 
            textShadow: '0 0 8px rgba(255,255,255,0.8), 1px 1px 2px rgba(0,0,0,0.3)'
          }}>
            {room.name.replace(/[^0-9]/g, '') || room.name}
          </div>
          
          {/* Temperature */}
          {temp !== undefined && !isNaN(temp) && (
            <div className="text-base font-bold" style={{
              color: temp < 5 ? '#0891b2' : temp < 10 ? '#14b8a6' : temp < 15 ? '#ca8a04' : '#ea580c',
              textShadow: `0 0 6px rgba(255,255,255,0.9), 1px 1px 2px rgba(0,0,0,0.2)`
            }}>
              {temp.toFixed(1)}°
            </div>
          )}

          {/* Status indicator */}
          {isDoorOpen && (
            <div className="w-1.5 h-1.5 bg-rose-500 rounded-full animate-pulse" style={{
              boxShadow: '0 0 8px #f43f5e'
            }}></div>
          )}
        </div>
      </Html>

      {/* Info tooltip on hover - No translation here as this is inside the 3D canvas */}
      {hovered && sensor?.additionalData && (
        <Html position={[0, height / 2 + 0.6, 0]} center>
          <div className="bg-white/95 backdrop-blur-sm rounded-lg p-3 shadow-xl border border-gray-200 min-w-[180px]">
            <div className="font-bold text-gray-900 mb-2 text-sm">{room.name}</div>
            <div className="space-y-1 text-xs">
              <div className="flex justify-between">
                <span className="text-gray-600">Température:</span>
                <span className="font-semibold text-red-700">
                  {temp !== undefined ? temp.toFixed(1) : '--'}°C
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Humidité:</span>
                <span className="font-semibold text-blue-700">
                  {humidity !== undefined ? humidity.toFixed(0) : '--'}%
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Porte:</span>
                <span className={`font-semibold ${isDoorOpen ? 'text-red-600' : 'text-green-600'}`}>
                  {isDoorOpen ? 'Ouverte' : 'Fermée'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Capacité:</span>
                <span className="font-semibold text-gray-900">{room.capacity}L</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Groupe:</span>
                <span className="font-semibold text-blue-600">F{room.athGroupNumber || 1}</span>
              </div>
            </div>
            <div className="mt-2 pt-2 border-t border-gray-200 text-[10px] text-gray-500 text-center">
              Cliquez pour voir les détails
            </div>
          </div>
        </Html>
      )}
    </group>
  );
};

// Main warehouse scene
const Warehouse3DView: React.FC<Warehouse3DViewProps> = ({ rooms, selectedRoom, onRoomClick }) => {
  const [internalSelectedRoom, setInternalSelectedRoom] = useState<Room | null>(selectedRoom || null);

  // Calculate positions - Compact warehouse layout
  const roomPositions = useMemo(() => {
    const positions: Map<string, [number, number, number]> = new Map();
    
    // Compact warehouse layout
    const avgScale = 1.3 + (6000 / 10000) * 0.4;
    const roomWidth = 2.8 * avgScale;
    const roomDepth = 3.5 * avgScale;
    const aisleWidth = 5; // Central corridor width
    const roomSpacing = roomDepth + 0.2; // Minimal gap between rooms
    
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
      
      const y = 3.5 / 2; // Half height (center of room)
      
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
        camera={{ position: [0, 14, 35], fov: 65 }}
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

        {/* Central corridor - Light polished aisle */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]} receiveShadow>
          <planeGeometry args={[5, 60]} />
          <meshStandardMaterial 
            color="#f1f5f9" 
            metalness={0.5} 
            roughness={0.3}
            emissive="#bae6fd"
            emissiveIntensity={0.2}
          />
        </mesh>

        {/* Aisle edge lines - Modern cyan markings */}
        <mesh position={[-2.5, 0.03, 0]}>
          <boxGeometry args={[0.15, 0.02, 60]} />
          <meshStandardMaterial color="#06b6d4" emissive="#06b6d4" emissiveIntensity={0.7} />
        </mesh>
        <mesh position={[2.5, 0.03, 0]}>
          <boxGeometry args={[0.15, 0.02, 60]} />
          <meshStandardMaterial color="#06b6d4" emissive="#06b6d4" emissiveIntensity={0.7} />
        </mesh>

        {/* Center line - Teal guide */}
        <mesh position={[0, 0.04, 0]}>
          <boxGeometry args={[0.1, 0.01, 60]} />
          <meshStandardMaterial color="#14b8a6" emissive="#14b8a6" emissiveIntensity={0.6} />
        </mesh>

        {/* WAREHOUSE BUILDING STRUCTURE - Modern Light Glass */}
        {/* Left External Wall */}
        <mesh position={[-13, 3.5, 0]} receiveShadow castShadow>
          <boxGeometry args={[0.25, 7, 60]} />
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
        <mesh position={[13, 3.5, 0]} receiveShadow castShadow>
          <boxGeometry args={[0.25, 7, 60]} />
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
        <mesh position={[0, 3.5, -30]} receiveShadow castShadow>
          <boxGeometry args={[26, 7, 0.25]} />
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
        <mesh position={[-10, 3.5, 30]} receiveShadow castShadow>
          <boxGeometry args={[6, 7, 0.25]} />
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
        <mesh position={[10, 3.5, 30]} receiveShadow castShadow>
          <boxGeometry args={[6, 7, 0.25]} />
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
        <mesh rotation={[0, 0, Math.PI / 5.5]} position={[-6.5, 9, 0]} receiveShadow castShadow>
          <boxGeometry args={[17, 0.2, 60.4]} />
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
        <mesh rotation={[0, 0, -Math.PI / 5.5]} position={[6.5, 9, 0]} receiveShadow castShadow>
          <boxGeometry args={[17, 0.2, 60.4]} />
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
        <mesh position={[0, 12, 0]} castShadow>
          <boxGeometry args={[0.3, 0.3, 60.4]} />
          <meshStandardMaterial 
            color="#bae6fd" 
            metalness={0.9} 
            roughness={0.1}
            emissive="#7dd3fc"
            emissiveIntensity={0.6}
          />
        </mesh>

        {/* Roof Support Beams - Modern Light Metal */}
        {[-25, -20, -15, -10, -5, 0, 5, 10, 15, 20, 25].map((z) => (
          <group key={`beam-group-${z}`}>
            {/* Left roof beam */}
            <mesh position={[-6.5, 9, z]} rotation={[0, 0, Math.PI / 5.5]} castShadow>
              <boxGeometry args={[17, 0.12, 0.2]} />
              <meshStandardMaterial 
                color="#bae6fd" 
                metalness={0.85} 
                roughness={0.15} 
                emissive="#7dd3fc" 
                emissiveIntensity={0.25}
              />
            </mesh>
            {/* Right roof beam */}
            <mesh position={[6.5, 9, z]} rotation={[0, 0, -Math.PI / 5.5]} castShadow>
              <boxGeometry args={[17, 0.12, 0.2]} />
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
          [-12.5, -28],
          [12.5, -28],
          [-12.5, -20],
          [12.5, -20],
          [-12.5, -12],
          [12.5, -12],
          [-12.5, -4],
          [12.5, -4],
          [-12.5, 4],
          [12.5, 4],
          [-12.5, 12],
          [12.5, 12],
          [-12.5, 20],
          [12.5, 20],
          [-12.5, 28],
          [12.5, 28],
        ].map(([x, z], i) => (
          <mesh key={`column-${i}`} position={[x, 3.5, z]} castShadow>
            <cylinderGeometry args={[0.25, 0.25, 7, 12]} />
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
        <mesh position={[0, 6, 30.1]} receiveShadow>
          <boxGeometry args={[16, 2.5, 0.15]} />
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
            />
          );
        })}

        {/* Warehouse title - Modern */}
        <Html position={[0, 10, -28]} center>
          <div className="text-2xl font-bold text-cyan-600 pointer-events-none" style={{
            textShadow: '0 0 10px #7dd3fc, 1px 1px 3px rgba(0,0,0,0.3)',
            letterSpacing: '2px'
          }}>
            ENTREPÔT FRIGORIFIQUE
          </div>
        </Html>

        {/* Camera controls - Optimized for compact warehouse */}
        <OrbitControls
          enablePan
          enableZoom
          enableRotate
          minDistance={12}
          maxDistance={70}
          maxPolarAngle={Math.PI / 2.2}
          target={[0, 3, 0]}
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

      {/* Stats overlay - Modern Light */}
      <div className="absolute top-3 left-3 md:top-6 md:left-6 bg-white/95 backdrop-blur-md rounded-xl p-3 md:p-4 shadow-2xl border border-cyan-200">
        <div className="text-xs md:text-sm font-bold text-cyan-600 mb-1.5 md:mb-2 flex items-center gap-1">
          <div className="w-2 h-2 bg-cyan-500 rounded-full animate-pulse"></div>
          Stats Live
        </div>
        <div className="space-y-0.5 md:space-y-1 text-[10px] md:text-xs">
          <div className="flex items-center gap-1.5">
            <span>🏢</span>
            <span className="font-bold text-cyan-600">{rooms.length}</span>
            <span className="text-slate-600 hidden md:inline">chambres</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span>❄️</span>
            <span className="font-bold text-blue-600">
              {(
                rooms.reduce((sum, r) => sum + (r.sensors?.[0]?.additionalData?.temperature || 0), 0) / rooms.length
              ).toFixed(1)}°C
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <span>🚨</span>
            <span className="font-bold text-rose-600">
              {rooms.filter((r) => r.sensors?.[0]?.additionalData?.magnet === 0).length}
            </span>
            <span className="text-slate-600 hidden md:inline">ouvertes</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Warehouse3DView;

