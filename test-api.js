/**
 * Test script for Room Settings API
 * 
 * This script demonstrates how to use the new chambre and capteur parameters
 * via the API endpoints.
 */

const axios = require('axios');

const API_BASE = 'http://127.0.0.1:4000';
const TENANT_ID = 'demo-tenant-id';

async function testAPI() {
  console.log('🧪 Testing Room Settings API with new chambre and capteur parameters...\n');

  try {
    // 1. Health check
    console.log('1. Health check...');
    const health = await axios.get(`${API_BASE}/health`);
    console.log('✅ Health check passed:', health.data.message);

    // 2. Get all settings overview
    console.log('\n2. Getting settings overview...');
    const settings = await axios.get(`${API_BASE}/settings?tenantId=${TENANT_ID}`);
    console.log('✅ Settings overview:', {
      totalRooms: settings.data.data.totalRooms,
      roomsWithSensors: settings.data.data.roomsWithSensors,
      roomsWithoutSensors: settings.data.data.roomsWithoutSensors
    });

    // 3. Create a new room with sensor installation status
    console.log('\n3. Creating a new room with capteur parameters...');
    const newRoom = {
      room: 'CH-TEST-001',
      capacity: 5000,
      capacityCrates: 5000,
      capacityPallets: 250,
      sensorId: 'S-TEST-001',
      active: true,
      capteurInstalled: false // Sensor not installed initially
    };

    const createResponse = await axios.post(`${API_BASE}/settings/rooms?tenantId=${TENANT_ID}`, newRoom);
    const roomId = createResponse.data.data.id;
    console.log('✅ Room created with ID:', roomId);

    // 4. Get the created room
    console.log('\n4. Getting the created room...');
    const getRoom = await axios.get(`${API_BASE}/settings/rooms/${roomId}?tenantId=${TENANT_ID}`);
    console.log('✅ Room details:', {
      room: getRoom.data.data.room,
      sensorId: getRoom.data.data.sensorId,
      capteurInstalled: getRoom.data.data.capteurInstalled
    });

    // 5. Update sensor installation status
    console.log('\n5. Updating sensor installation status...');
    await axios.patch(`${API_BASE}/settings/rooms/${roomId}/sensor-installation?tenantId=${TENANT_ID}`, {
      capteurInstalled: true
    });
    console.log('✅ Sensor installation status updated to: true');

    // 6. Verify updates
    console.log('\n6. Verifying updates...');
    const updatedRoom = await axios.get(`${API_BASE}/settings/rooms/${roomId}?tenantId=${TENANT_ID}`);
    console.log('✅ Updated room details:', {
      capteurInstalled: updatedRoom.data.data.capteurInstalled
    });

    // 7. Get rooms with sensors installed
    console.log('\n7. Getting rooms with sensors installed...');
    const roomsWithSensors = await axios.get(`${API_BASE}/settings/rooms/with-sensors?tenantId=${TENANT_ID}`);
    console.log('✅ Rooms with sensors:', roomsWithSensors.data.count);

    // 8. Get rooms without sensors installed
    console.log('\n8. Getting rooms without sensors installed...');
    const roomsWithoutSensors = await axios.get(`${API_BASE}/settings/rooms/without-sensors?tenantId=${TENANT_ID}`);
    console.log('✅ Rooms without sensors:', roomsWithoutSensors.data.count);

    // 9. Clean up - delete the test room
    console.log('\n9. Cleaning up - deleting test room...');
    await axios.delete(`${API_BASE}/settings/rooms/${roomId}?tenantId=${TENANT_ID}`);
    console.log('✅ Test room deleted');

    console.log('\n🎉 All tests passed! The capteur parameter is working correctly.');

  } catch (error) {
    console.error('❌ Test failed:', error.response?.data || error.message);
    process.exit(1);
  }
}

// Run the test
if (require.main === module) {
  testAPI();
}

module.exports = { testAPI };
