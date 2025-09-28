# Room Settings API Documentation

This document describes the API endpoints for managing room settings, including the new `capteur` parameter for tracking sensor installation status.

## Server Setup

To run the API server:

```bash
# Install dependencies
npm install --package-lock-only
npm install express cors

# Start the server
node api-server.js
```

The server will be available at `http://127.0.0.1:4000`

## API Endpoints

### Base URL
```
http://127.0.0.1:4000
```

### Authentication
Currently, the API uses a mock tenant ID. In a production environment, implement proper authentication.

### Endpoints

#### 1. Get All Settings Overview
```http
GET /settings?tenantId=your-tenant-id
```

**Response:**
```json
{
  "success": true,
  "data": {
    "totalRooms": 5,
    "roomsWithSensors": 3,
    "roomsWithoutSensors": 2,
    "rooms": [...],
    "sensorInstallationStatus": {
      "withSensors": [...],
      "withoutSensors": [...]
    }
  }
}
```

#### 2. Get All Rooms
```http
GET /settings/rooms?tenantId=your-tenant-id
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "room-id",
      "tenantId": "tenant-id",
      "room": "CH1",
      "capacity": 6000,
      "capacityCrates": 6000,
      "capacityPallets": 300,
      "sensorId": "S-CH1",
      "active": true,
      "capteurInstalled": true,
      "createdAt": "2024-01-15T10:30:00.000Z"
    }
  ],
  "count": 1
}
```

#### 3. Get Specific Room
```http
GET /settings/rooms/:id?tenantId=your-tenant-id
```

#### 4. Create New Room
```http
POST /settings/rooms?tenantId=your-tenant-id
Content-Type: application/json

{
  "room": "CH1",
  "capacity": 6000,
  "capacityCrates": 6000,
  "capacityPallets": 300,
  "sensorId": "S-CH1",
  "active": true,
  "capteurInstalled": false
}
```

**Required fields:** `room`, `sensorId`

**Response:**
```json
{
  "success": true,
  "data": { "id": "new-room-id" },
  "message": "Room created successfully"
}
```

#### 5. Update Room
```http
PUT /settings/rooms/:id?tenantId=your-tenant-id
Content-Type: application/json

{
  "room": "CH1-UPDATED",
  "capteurInstalled": true
}
```

#### 6. Delete Room
```http
DELETE /settings/rooms/:id?tenantId=your-tenant-id
```

#### 7. Get Rooms with Sensors Installed
```http
GET /settings/rooms/with-sensors?tenantId=your-tenant-id
```

#### 8. Get Rooms without Sensors Installed
```http
GET /settings/rooms/without-sensors?tenantId=your-tenant-id
```

#### 9. Update Sensor Installation Status
```http
PATCH /settings/rooms/:id/sensor-installation?tenantId=your-tenant-id
Content-Type: application/json

{
  "capteurInstalled": true
}
```

#### 10. Health Check
```http
GET /health
```

## New Parameters

### `capteurInstalled` (boolean)
- Indicates whether a sensor is installed in the room
- Default: `false`
- Used to track sensor installation status

## Example Usage

### JavaScript/Node.js
```javascript
const axios = require('axios');

const API_BASE = 'http://127.0.0.1:4000';
const TENANT_ID = 'your-tenant-id';

// Get all rooms
async function getRooms() {
  try {
    const response = await axios.get(`${API_BASE}/settings/rooms?tenantId=${TENANT_ID}`);
    console.log('Rooms:', response.data.data);
  } catch (error) {
    console.error('Error:', error.response?.data || error.message);
  }
}

// Create a new room with sensor installation status
async function createRoom() {
  try {
    const response = await axios.post(`${API_BASE}/settings/rooms?tenantId=${TENANT_ID}`, {
      room: 'CH2',
      capacity: 8000,
      capacityCrates: 8000,
      sensorId: 'S-CH2',
      active: true,
      capteurInstalled: true
    });
    console.log('Created room:', response.data.data);
  } catch (error) {
    console.error('Error:', error.response?.data || error.message);
  }
}

// Update sensor installation status
async function updateSensorStatus(roomId, installed) {
  try {
    const response = await axios.patch(
      `${API_BASE}/settings/rooms/${roomId}/sensor-installation?tenantId=${TENANT_ID}`,
      { capteurInstalled: installed }
    );
    console.log('Updated:', response.data.message);
  } catch (error) {
    console.error('Error:', error.response?.data || error.message);
  }
}
```

### cURL Examples
```bash
# Get all rooms
curl "http://127.0.0.1:4000/settings/rooms?tenantId=your-tenant-id"

# Create a new room
curl -X POST "http://127.0.0.1:4000/settings/rooms?tenantId=your-tenant-id" \
  -H "Content-Type: application/json" \
  -d '{
    "room": "CH3",
    "capacity": 5000,
    "sensorId": "S-CH3",
    "capteurInstalled": false
  }'

# Update sensor installation status
curl -X PATCH "http://127.0.0.1:4000/settings/rooms/room-id/sensor-installation?tenantId=your-tenant-id" \
  -H "Content-Type: application/json" \
  -d '{"capteurInstalled": true}'

# Get rooms with sensors installed
curl "http://127.0.0.1:4000/settings/rooms/with-sensors?tenantId=your-tenant-id"
```

## Error Responses

All endpoints return consistent error responses:

```json
{
  "success": false,
  "error": "Error description",
  "message": "Detailed error message"
}
```

Common HTTP status codes:
- `200` - Success
- `201` - Created
- `400` - Bad Request (validation errors)
- `404` - Not Found
- `500` - Internal Server Error

## Frontend Integration

The frontend has been updated to include the new parameters:

1. **Room Form**: Added fields for `capteurInstalled` (checkbox) and `chambre` (text input)
2. **Room Table**: Added columns to display sensor installation status and room identifier
3. **Data Structure**: Updated to handle the new fields in create, read, update operations

The new parameters are now available in both the web interface and the API endpoints.
