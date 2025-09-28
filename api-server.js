/**
 * Simple API Server for Room Settings
 * 
 * This server provides HTTP endpoints to interact with room settings,
 * including the new chambre and capteur parameters.
 * 
 * To run: node api-server.js
 * Server will be available at http://127.0.0.1:4000
 */

const express = require('express');
const cors = require('cors');
const { createRoomSettingsAPI } = require('./src/lib/api/roomSettings');

const app = express();
const PORT = 4000;

// Middleware
app.use(cors());
app.use(express.json());

// Mock tenant ID for demonstration
// In a real application, this would come from authentication
const DEFAULT_TENANT_ID = 'demo-tenant-id';

/**
 * GET /settings/rooms
 * Get all rooms for the tenant
 */
app.get('/settings/rooms', async (req, res) => {
  try {
    const tenantId = req.query.tenantId || DEFAULT_TENANT_ID;
    const roomAPI = createRoomSettingsAPI(tenantId);
    const rooms = await roomAPI.getAllRooms();
    
    res.json({
      success: true,
      data: rooms,
      count: rooms.length
    });
  } catch (error) {
    console.error('Error fetching rooms:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch rooms',
      message: error.message
    });
  }
});

/**
 * GET /settings/rooms/:id
 * Get a specific room by ID
 */
app.get('/settings/rooms/:id', async (req, res) => {
  try {
    const tenantId = req.query.tenantId || DEFAULT_TENANT_ID;
    const roomAPI = createRoomSettingsAPI(tenantId);
    const room = await roomAPI.getRoom(req.params.id);
    
    if (!room) {
      return res.status(404).json({
        success: false,
        error: 'Room not found'
      });
    }
    
    res.json({
      success: true,
      data: room
    });
  } catch (error) {
    console.error('Error fetching room:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch room',
      message: error.message
    });
  }
});

/**
 * POST /settings/rooms
 * Create a new room
 */
app.post('/settings/rooms', async (req, res) => {
  try {
    const tenantId = req.query.tenantId || DEFAULT_TENANT_ID;
    const roomAPI = createRoomSettingsAPI(tenantId);
    
    const { room, capacity, capacityCrates, capacityPallets, sensorId, active, capteurInstalled } = req.body;
    
    // Validate required fields
    if (!room || !sensorId) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: room and sensorId are required'
      });
    }
    
    const roomId = await roomAPI.createRoom({
      room,
      capacity: capacity || 0,
      capacityCrates: capacityCrates || 0,
      capacityPallets: capacityPallets || 0,
      sensorId,
      active: active !== undefined ? active : true,
      capteurInstalled: capteurInstalled !== undefined ? capteurInstalled : false
    });
    
    res.status(201).json({
      success: true,
      data: { id: roomId },
      message: 'Room created successfully'
    });
  } catch (error) {
    console.error('Error creating room:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create room',
      message: error.message
    });
  }
});

/**
 * PUT /settings/rooms/:id
 * Update an existing room
 */
app.put('/settings/rooms/:id', async (req, res) => {
  try {
    const tenantId = req.query.tenantId || DEFAULT_TENANT_ID;
    const roomAPI = createRoomSettingsAPI(tenantId);
    
    const updates = req.body;
    await roomAPI.updateRoom(req.params.id, updates);
    
    res.json({
      success: true,
      message: 'Room updated successfully'
    });
  } catch (error) {
    console.error('Error updating room:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update room',
      message: error.message
    });
  }
});

/**
 * DELETE /settings/rooms/:id
 * Delete a room
 */
app.delete('/settings/rooms/:id', async (req, res) => {
  try {
    const tenantId = req.query.tenantId || DEFAULT_TENANT_ID;
    const roomAPI = createRoomSettingsAPI(tenantId);
    
    await roomAPI.deleteRoom(req.params.id);
    
    res.json({
      success: true,
      message: 'Room deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting room:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete room',
      message: error.message
    });
  }
});

/**
 * GET /settings/rooms/with-sensors
 * Get rooms with sensors installed
 */
app.get('/settings/rooms/with-sensors', async (req, res) => {
  try {
    const tenantId = req.query.tenantId || DEFAULT_TENANT_ID;
    const roomAPI = createRoomSettingsAPI(tenantId);
    const rooms = await roomAPI.getRoomsWithSensors();
    
    res.json({
      success: true,
      data: rooms,
      count: rooms.length
    });
  } catch (error) {
    console.error('Error fetching rooms with sensors:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch rooms with sensors',
      message: error.message
    });
  }
});

/**
 * GET /settings/rooms/without-sensors
 * Get rooms without sensors installed
 */
app.get('/settings/rooms/without-sensors', async (req, res) => {
  try {
    const tenantId = req.query.tenantId || DEFAULT_TENANT_ID;
    const roomAPI = createRoomSettingsAPI(tenantId);
    const rooms = await roomAPI.getRoomsWithoutSensors();
    
    res.json({
      success: true,
      data: rooms,
      count: rooms.length
    });
  } catch (error) {
    console.error('Error fetching rooms without sensors:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch rooms without sensors',
      message: error.message
    });
  }
});

/**
 * PATCH /settings/rooms/:id/sensor-installation
 * Update sensor installation status for a room
 */
app.patch('/settings/rooms/:id/sensor-installation', async (req, res) => {
  try {
    const tenantId = req.query.tenantId || DEFAULT_TENANT_ID;
    const roomAPI = createRoomSettingsAPI(tenantId);
    
    const { capteurInstalled } = req.body;
    
    if (typeof capteurInstalled !== 'boolean') {
      return res.status(400).json({
        success: false,
        error: 'capteurInstalled must be a boolean value'
      });
    }
    
    await roomAPI.updateSensorInstallation(req.params.id, capteurInstalled);
    
    res.json({
      success: true,
      message: 'Sensor installation status updated successfully'
    });
  } catch (error) {
    console.error('Error updating sensor installation:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update sensor installation status',
      message: error.message
    });
  }
});


/**
 * GET /settings
 * Get all settings (rooms overview)
 */
app.get('/settings', async (req, res) => {
  try {
    const tenantId = req.query.tenantId || DEFAULT_TENANT_ID;
    const roomAPI = createRoomSettingsAPI(tenantId);
    
    const allRooms = await roomAPI.getAllRooms();
    const roomsWithSensors = await roomAPI.getRoomsWithSensors();
    const roomsWithoutSensors = await roomAPI.getRoomsWithoutSensors();
    
    res.json({
      success: true,
      data: {
        totalRooms: allRooms.length,
        roomsWithSensors: roomsWithSensors.length,
        roomsWithoutSensors: roomsWithoutSensors.length,
        rooms: allRooms,
        sensorInstallationStatus: {
          withSensors: roomsWithSensors,
          withoutSensors: roomsWithoutSensors
        }
      }
    });
  } catch (error) {
    console.error('Error fetching settings:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch settings',
      message: error.message
    });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'Room Settings API is running',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    success: false,
    error: 'Internal server error',
    message: err.message
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint not found',
    message: `The endpoint ${req.method} ${req.path} does not exist`
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Room Settings API Server running on http://127.0.0.1:${PORT}`);
  console.log(`📚 API Documentation:`);
  console.log(`   GET    /settings                    - Get all settings overview`);
  console.log(`   GET    /settings/rooms              - Get all rooms`);
  console.log(`   GET    /settings/rooms/:id          - Get specific room`);
  console.log(`   POST   /settings/rooms              - Create new room`);
  console.log(`   PUT    /settings/rooms/:id          - Update room`);
  console.log(`   DELETE /settings/rooms/:id          - Delete room`);
  console.log(`   GET    /settings/rooms/with-sensors - Get rooms with sensors`);
  console.log(`   GET    /settings/rooms/without-sensors - Get rooms without sensors`);
  console.log(`   PATCH  /settings/rooms/:id/sensor-installation - Update sensor status`);
  console.log(`   GET    /health                      - Health check`);
});

module.exports = app;
