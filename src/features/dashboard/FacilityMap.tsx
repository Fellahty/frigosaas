import React, { useState, useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import ReactFlow, {
  Node,
  Edge,
  Controls,
  Background,
  BackgroundVariant,
  useNodesState,
  useEdgesState,
  addEdge,
  Connection,
  NodeTypes,
  ReactFlowProvider,
  useReactFlow,
  Handle,
  Position,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { Card } from '../../components/Card';
import { RoomSummary } from '../../types/metrics';
import { db } from '../../lib/firebase';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { useTenantId } from '../../lib/hooks/useTenantId';

interface FacilityMapProps {
  rooms: RoomSummary[];
}

// Custom Room Node Component
const RoomNode: React.FC<{ data: any }> = ({ data }) => {
  const { room, layout, batteryConfig, occupancyPercentage } = data;

  return (
    <div className="bg-white rounded-lg border-2 border-gray-200 shadow-lg hover:shadow-xl transition-all duration-300 min-w-[400px] min-h-[80px] relative">
      {/* React Flow handles for connecting edges */}
      <Handle type="target" position={Position.Left} id="target" />
      <Handle type="source" position={Position.Right} id="source" />
      {/* Room Header */}
      <div className={`h-12 ${batteryConfig.color} rounded-t-lg flex items-center justify-center relative`}>
        <div className="text-center text-white">
          <div className="font-bold text-base">{layout.name}</div>
          <div className="text-sm opacity-90">
            {room.currentOccupancy}/{room.capacity}
          </div>
        </div>
        
        {/* Status Badge */}
        <div className="absolute top-1 right-2">
          <div className={`px-3 py-1 rounded-full text-xs font-bold bg-white ${batteryConfig.statusColor} shadow-sm`}>
            {batteryConfig.status}
          </div>
        </div>
      </div>
      
      {/* Room Content */}
      <div className="p-3">
        {/* Horizontal Layout: All info in one row */}
        <div className="flex items-center justify-between">
          {/* Left: Percentage */}
          <div className="text-center min-w-[80px]">
            <div className="text-2xl font-bold text-gray-800 mb-1">
              {occupancyPercentage}%
            </div>
            <div className="text-xs text-gray-600">Occupation</div>
          </div>
          
          {/* Center: Progress Bar */}
          <div className="flex-1 mx-6">
            <div className="text-xs text-gray-600 mb-1">Progression</div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div 
                className={`h-2 ${batteryConfig.color} rounded-full transition-all duration-1000 ease-out`}
                style={{ width: `${occupancyPercentage}%` }}
              ></div>
            </div>
          </div>
          
          {/* Right: Metrics */}
          <div className="flex items-center space-x-6 min-w-[200px]">
            <div className="text-center">
              <div className="font-semibold text-gray-700 text-sm">{room.temperature.toFixed(1)}°C</div>
              <div className="text-gray-500 text-xs">Temp</div>
            </div>
            <div className="text-center">
              <div className="font-semibold text-gray-700 text-sm">{room.humidity.toFixed(1)}%</div>
              <div className="text-gray-500 text-xs">Hum</div>
            </div>
            <div className="text-center">
              <div className="font-semibold text-gray-700 text-sm">{room.capacity - room.currentOccupancy}</div>
              <div className="text-gray-500 text-xs">Libre</div>
            </div>
          </div>
        </div>

        {/* Storage Visualization - Horizontal */}
        <div className="mt-3 pt-2 border-t border-gray-200">
          <div className="text-xs text-gray-500 mb-1">Stockage:</div>
          <div className="flex items-center justify-center space-x-1">
            {/* Represent storage containers horizontally */}
            {[...Array(Math.min(12, Math.ceil(occupancyPercentage / 8)))].map((_, i) => (
              <div 
                key={i} 
                className={`w-2 h-2 rounded-sm ${batteryConfig.color} opacity-80`}
                title={`Container ${i + 1}`}
              ></div>
            ))}
            {[...Array(Math.max(0, 12 - Math.ceil(occupancyPercentage / 8)))].map((_, i) => (
              <div 
                key={`empty-${i}`} 
                className="w-2 h-2 rounded-sm bg-gray-200 border border-gray-300"
                title="Espace vide"
              ></div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

// Node Types
const nodeTypes: NodeTypes = {
  roomNode: RoomNode,
};

// Inner component that has access to ReactFlow instance
const FacilityMapInner: React.FC<FacilityMapProps> = ({ rooms }) => {
  const { t } = useTranslation();
  const { fitView } = useReactFlow();
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
  const [savedPositions, setSavedPositions] = useState<Record<string, { x: number; y: number }>>({});
  const [isLoadingPositions, setIsLoadingPositions] = useState(true);
  const tenantId = useTenantId();

  // Calculate responsive grid layout
  const calculateResponsiveLayout = () => {
    const containerWidth = containerSize.width || 1200; // fallback width
    const containerHeight = containerSize.height || 600; // fallback height
    
    // Card dimensions (from our min-w-[400px] min-h-[80px])
    const cardWidth = 400;
    const cardHeight = 80;
    
    // Calculate optimal grid
    const cols = Math.max(2, Math.floor(containerWidth / (cardWidth + 100))); // 100px spacing
    const rows = Math.ceil(rooms.length / cols);
    
    // Calculate spacing
    const horizontalSpacing = (containerWidth - (cols * cardWidth)) / (cols + 1);
    const verticalSpacing = (containerHeight - (rows * cardHeight)) / (rows + 1);
    
    return {
      cols,
      rows,
      cardWidth,
      cardHeight,
      horizontalSpacing: Math.max(50, horizontalSpacing),
      verticalSpacing: Math.max(80, verticalSpacing),
    };
  };

  // Update container size on resize
  React.useEffect(() => {
    const updateSize = () => {
      const container = document.querySelector('.react-flow') as HTMLElement;
      if (container) {
        setContainerSize({
          width: container.clientWidth,
          height: container.clientHeight,
        });
      }
    };

    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, []);

  const getOccupancyPercentage = (current: number, capacity: number) => {
    return Math.round((current / capacity) * 100);
  };

  // Load saved positions from Firebase
  const loadSavedPositions = useCallback(async () => {
    try {
      const positionsDoc = doc(db, 'facility_layouts', tenantId);
      const docSnap = await getDoc(positionsDoc);
      
      if (docSnap.exists()) {
        const data = docSnap.data();
        setSavedPositions(data.roomPositions || {});
      }
    } catch (error) {
      console.error('Error loading saved positions:', error);
    } finally {
      setIsLoadingPositions(false);
    }
  }, [tenantId]);

  // Save positions to Firebase
  const savePositions = useCallback(async (positions: Record<string, { x: number; y: number }>) => {
    try {
      const positionsDoc = doc(db, 'facility_layouts', tenantId);
      await setDoc(positionsDoc, {
        roomPositions: positions,
        lastUpdated: new Date(),
        tenantId: tenantId
      }, { merge: true });
      
      setSavedPositions(positions);
    } catch (error) {
      console.error('Error saving positions:', error);
    }
  }, [tenantId]);

  // Load positions on component mount
  useEffect(() => {
    loadSavedPositions();
  }, [loadSavedPositions]);

  const getBatteryConfig = (percentage: number) => {
    if (percentage >= 80) {
      return {
        color: 'bg-red-500',
        borderColor: 'border-red-600',
        textColor: 'text-red-700',
        status: 'Critical',
        statusColor: 'text-red-600',
        statusBg: 'bg-red-100'
      };
    }
    if (percentage >= 60) {
      return {
        color: 'bg-orange-500',
        borderColor: 'border-orange-600',
        textColor: 'text-orange-700',
        status: 'Warning',
        statusColor: 'text-orange-600',
        statusBg: 'bg-orange-100'
      };
    }
    if (percentage >= 40) {
      return {
        color: 'bg-yellow-500',
        borderColor: 'border-yellow-600',
        textColor: 'text-yellow-700',
        status: 'Moderate',
        statusColor: 'text-yellow-600',
        statusBg: 'bg-yellow-100'
      };
    }
    if (percentage >= 20) {
      return {
        color: 'bg-blue-500',
        borderColor: 'border-blue-600',
        textColor: 'text-blue-700',
        status: 'Low',
        statusColor: 'text-blue-600',
        statusBg: 'bg-blue-100'
      };
    }
    return {
      color: 'bg-green-500',
      borderColor: 'border-green-600',
      textColor: 'text-green-700',
      status: 'Empty',
      statusColor: 'text-green-600',
      statusBg: 'bg-green-100'
    };
  };

  // Create ReactFlow nodes with saved or calculated positioning
  const createNodes = useCallback(() => {
    return rooms.map((roomData, index) => {
      const layout = { id: roomData.id, name: roomData.name };

      const occupancyPercentage = getOccupancyPercentage(roomData.currentOccupancy, roomData.capacity);
      const batteryConfig = getBatteryConfig(occupancyPercentage);

      // Use saved position if available, otherwise calculate responsive position
      let position: { x: number; y: number };
      
      if (savedPositions[roomData.id] && !isLoadingPositions) {
        // Use saved position
        position = savedPositions[roomData.id];
      } else {
        // Calculate responsive position
        const layoutConfig = calculateResponsiveLayout();
        const row = Math.floor(index / layoutConfig.cols);
        const col = index % layoutConfig.cols;
        
        position = {
          x: layoutConfig.horizontalSpacing + col * (layoutConfig.cardWidth + layoutConfig.horizontalSpacing),
          y: layoutConfig.verticalSpacing + row * (layoutConfig.cardHeight + layoutConfig.verticalSpacing)
        };
      }

      return {
        id: roomData.id,
        type: 'roomNode',
        position,
        data: {
          room: roomData,
          layout,
          batteryConfig,
          occupancyPercentage,
        },
        draggable: true,
        selectable: true,
      };
    }).filter(Boolean) as Node[];
  }, [rooms, savedPositions, isLoadingPositions, containerSize]);

  const initialNodes = createNodes();

  // Create connections between rooms (optional)
  const initialEdges: Edge[] = [];

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  const onConnect = useCallback(
    (params: Connection) => setEdges((eds) => addEdge(params, eds)),
    [setEdges],
  );

  // Custom onNodesChange to save positions when nodes are moved
  const handleNodesChange = useCallback((changes: any) => {
    onNodesChange(changes);
    
    // Check if any node position changed
    const positionChanges = changes.filter((change: any) => 
      change.type === 'position' && change.position
    );
    
    if (positionChanges.length > 0) {
      // Debounce saving to avoid too many Firebase calls
      const timeoutId = setTimeout(() => {
        const newPositions: Record<string, { x: number; y: number }> = {};
        
        // Get current positions from all nodes
        setNodes((currentNodes) => {
          currentNodes.forEach((node) => {
            newPositions[node.id] = { x: node.position.x, y: node.position.y };
          });
          
          // Save to Firebase
          savePositions(newPositions);
          
          return currentNodes;
        });
      }, 1000); // 1 second debounce
      
      return () => clearTimeout(timeoutId);
    }
  }, [onNodesChange, savePositions, setNodes]);

  // Update nodes when saved positions are loaded or container size changes
  useEffect(() => {
    if (!isLoadingPositions) {
      const newNodes = createNodes();
      setNodes(newNodes);
    }
  }, [savedPositions, isLoadingPositions, createNodes, setNodes]);

  // Ensure view fits when nodes are available (handles timing issues)
  useEffect(() => {
    if (nodes.length > 0) {
      const t = setTimeout(() => fitView({ padding: 0.15, duration: 600 }), 50);
      return () => clearTimeout(t);
    }
  }, [nodes, fitView]);

  return (
    <Card title="Carte des Installations Frigorifiques" className="h-full">
      <div className="space-y-6">
        {/* Enhanced Legend */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 p-6 bg-gradient-to-r from-gray-50 to-gray-100 rounded-xl">
          {[
            { label: 'Vide (0-19%)', color: 'bg-green-500', bg: 'bg-green-100', text: 'text-green-700' },
            { label: 'Faible (20-39%)', color: 'bg-blue-500', bg: 'bg-blue-100', text: 'text-blue-700' },
            { label: 'Modéré (40-59%)', color: 'bg-yellow-500', bg: 'bg-yellow-100', text: 'text-yellow-700' },
            { label: 'Attention (60-79%)', color: 'bg-orange-500', bg: 'bg-orange-100', text: 'text-orange-700' },
            { label: 'Critique (80-100%)', color: 'bg-red-500', bg: 'bg-red-100', text: 'text-red-700' },
          ].map((item, index) => (
            <div key={index} className={`${item.bg} rounded-lg p-3 border border-gray-200`}>
              <div className="flex items-center gap-3">
                <div className={`w-4 h-4 rounded-full ${item.color}`}></div>
                <span className={`text-xs font-medium ${item.text}`}>{item.label}</span>
              </div>
            </div>
          ))}
        </div>

        {/* ReactFlow Facility Map - Enhanced Styling */}
        <div className="h-[700px] bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 rounded-3xl border-2 border-gray-200/50 overflow-hidden relative shadow-2xl">
          {/* Decorative Corner Elements */}
          <div className="absolute top-0 left-0 w-20 h-20 bg-gradient-to-br from-blue-500/20 to-transparent rounded-br-3xl"></div>
          <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-to-bl from-indigo-500/20 to-transparent rounded-bl-3xl"></div>
          <div className="absolute bottom-0 left-0 w-20 h-20 bg-gradient-to-tr from-purple-500/20 to-transparent rounded-tr-3xl"></div>
          <div className="absolute bottom-0 right-0 w-20 h-20 bg-gradient-to-tl from-cyan-500/20 to-transparent rounded-tl-3xl"></div>
                    {/* Compact Professional Entrance Port */}
          <div className="absolute bottom-3 left-1/2 transform -translate-x-1/2 z-10">
            <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-4 py-2 rounded-lg text-center shadow-lg border border-white/30">
              <div className="text-sm font-semibold">ENTRÉE</div>
            </div>
          </div>

          <ReactFlow
              nodes={nodes}
              edges={edges}
              onNodesChange={handleNodesChange}
              onEdgesChange={onEdgesChange}
              onConnect={onConnect}
              nodeTypes={nodeTypes}
              defaultViewport={{ x: 0, y: 0, zoom: 0.8 }}
              minZoom={0.2}
              maxZoom={3}
              fitView={false}
              attributionPosition="bottom-left"
              className="bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100"
              style={{
                background: 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 50%, #ddd6fe 100%)',
              }}
              onInit={() => {
                // Auto-fit view after initialization
                setTimeout(() => fitView({ padding: 0.1, duration: 1000 }), 100);
              }}
            >
              {nodes.length === 0 && (
                <div className="absolute inset-0 flex items-center justify-center z-20 pointer-events-none">
                  <div className="bg-white/80 px-4 py-2 rounded-md text-sm text-gray-700 border">
                    No rooms to display
                  </div>
                </div>
              )}
              {/* Enhanced Professional Controls */}
              <Controls 
                className="bg-white/95 backdrop-blur-sm rounded-xl shadow-xl border border-gray-200/50"
                showZoom={true}
                showFitView={true}
                showInteractive={true}
                fitViewOptions={{ padding: 0.15, duration: 1000 }}
                position="top-right"
              />
              
              {/* Enhanced Background Pattern */}
              <Background
                variant={BackgroundVariant.Dots}
                color="#94a3b8"
                gap={25}
                size={1.5}
                className="opacity-25"
              />
              
                            {/* Compact Zoom to Fit Button */}
              <div className="absolute top-3 left-3 z-10">
                <button
                  onClick={() => fitView({ padding: 0.1, duration: 1000 })}
                  className="bg-white/90 backdrop-blur-sm border border-gray-200/50 rounded-lg px-3 py-2 text-xs font-medium text-gray-600 hover:bg-white hover:shadow-md transition-all duration-200 shadow-md"
                  title="Vue d'ensemble"
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                  </svg>
                </button>
              </div>
              
              {/* Compact Facility Status Overlay */}
              <div className="absolute top-3 right-3 z-10 bg-white/95 backdrop-blur-sm border border-gray-200/50 rounded-lg p-3 shadow-lg max-w-[200px]">
                <div className="flex items-center space-x-2 mb-2">
                  <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                  <h3 className="font-semibold text-gray-800 text-xs">Installation</h3>
                </div>
                <div className="space-y-1 text-xs text-gray-600">
                  <div className="flex justify-between items-center">
                    <span>Capacité:</span>
                    <span className="font-bold text-blue-600">{rooms.reduce((sum, room) => sum + room.capacity, 0)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span>Occupation:</span>
                    <span className="font-bold text-green-600">{rooms.reduce((sum, room) => sum + room.currentOccupancy, 0)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span>Utilisation:</span>
                    <span className="font-bold text-purple-600">
                      {Math.round((rooms.reduce((sum, room) => sum + room.currentOccupancy, 0) / rooms.reduce((sum, room) => sum + room.capacity, 0)) * 100)}%
                    </span>
                  </div>
                  {/* Position Save Status */}
                  <div className="pt-1 border-t border-gray-200">
                    <div className="flex justify-between items-center">
                      <span>Positions:</span>
                      <span className="font-bold text-green-600 text-xs">Sauvegardées</span>
                    </div>
                  </div>
                </div>
              </div>
            </ReactFlow>
        </div>
 
 
      </div>
    </Card>
  );
};

// Main component with ReactFlowProvider
export const FacilityMap: React.FC<FacilityMapProps> = ({ rooms }) => {
  return (
    <ReactFlowProvider>
      <FacilityMapInner rooms={rooms} />
    </ReactFlowProvider>
  );
};
