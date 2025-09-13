export interface AlertItem {
  id: string;
  type: 'warning' | 'error' | 'info';
  message: string;
  timestamp: Date;
  roomId?: string;
}

export interface RoomSummary {
  id: string;
  name: string;
  capacity: number;
  currentOccupancy: number;
  temperature: number;
  humidity: number;
}

export interface Kpis {
  totalRooms: number;
  totalClients: number;
  averageTemperature: number;
  averageHumidity: number;
  alertsCount: number;
}

export interface TopClient {
  id: string;
  name: string;
  usage: number;
  lastVisit: Date;
}

export interface MoveItem {
  id: string;
  clientId: string;
  clientName: string;
  fromRoom: string;
  toRoom: string;
  timestamp: Date;
  reason: string;
}

export interface MetricsToday {
  tenantId: string;
  date: string;
  kpis: Kpis;
  rooms: RoomSummary[];
  alerts: AlertItem[];
  topClients: TopClient[];
  recentMoves: MoveItem[];
  lastUpdated: Date;
}
