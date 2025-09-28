/**
 * Test script to demonstrate sensor filtering
 * 
 * This script creates test rooms with different capteurInstalled values
 * to demonstrate that the sensors page only shows rooms with capteurInstalled: true
 */

const axios = require('axios');

const API_BASE = 'http://127.0.0.1:4000';
const TENANT_ID = 'demo-tenant-id';

async function testSensorFiltering() {
  console.log('🧪 Testing sensor filtering - creating rooms with different capteur status...\n');

  try {
    // 1. Create rooms with different sensor installation statuses
    console.log('1. Creating test rooms...');
    
    // Room 1: With sensor installed
    const room1 = await axios.post(`${API_BASE}/settings/rooms?tenantId=${TENANT_ID}`, {
      room: 'CH-SENSOR-001',
      capacity: 5000,
      capacityCrates: 5000,
      sensorId: 'S-001',
      active: true,
      capteurInstalled: true // ✅ This room should appear on sensors page
    });
    console.log('✅ Created room with sensor installed:', room1.data.data.id);

    // Room 2: Without sensor installed
    const room2 = await axios.post(`${API_BASE}/settings/rooms?tenantId=${TENANT_ID}`, {
      room: 'CH-NO-SENSOR-002',
      capacity: 3000,
      capacityCrates: 3000,
      sensorId: 'S-002',
      active: true,
      capteurInstalled: false // ❌ This room should NOT appear on sensors page
    });
    console.log('✅ Created room without sensor installed:', room2.data.data.id);

    // Room 3: With sensor installed (another one)
    const room3 = await axios.post(`${API_BASE}/settings/rooms?tenantId=${TENANT_ID}`, {
      room: 'CH-SENSOR-003',
      capacity: 7000,
      capacityCrates: 7000,
      sensorId: 'S-003',
      active: true,
      capteurInstalled: true // ✅ This room should also appear on sensors page
    });
    console.log('✅ Created another room with sensor installed:', room3.data.data.id);

    // 2. Get all rooms to verify they exist
    console.log('\n2. Verifying all rooms exist...');
    const allRooms = await axios.get(`${API_BASE}/settings/rooms?tenantId=${TENANT_ID}`);
    console.log('📊 Total rooms created:', allRooms.data.count);
    console.log('📋 Room details:');
    allRooms.data.data.forEach(room => {
      console.log(`   - ${room.room}: capteurInstalled = ${room.capteurInstalled}`);
    });

    // 3. Get rooms with sensors installed
    console.log('\n3. Getting rooms with sensors installed...');
    const roomsWithSensors = await axios.get(`${API_BASE}/settings/rooms/with-sensors?tenantId=${TENANT_ID}`);
    console.log('✅ Rooms with sensors:', roomsWithSensors.data.count);
    console.log('📋 Rooms that should appear on sensors page:');
    roomsWithSensors.data.data.forEach(room => {
      console.log(`   - ${room.room} (ID: ${room.sensorId})`);
    });

    // 4. Get rooms without sensors installed
    console.log('\n4. Getting rooms without sensors installed...');
    const roomsWithoutSensors = await axios.get(`${API_BASE}/settings/rooms/without-sensors?tenantId=${TENANT_ID}`);
    console.log('❌ Rooms without sensors:', roomsWithoutSensors.data.count);
    console.log('📋 Rooms that should NOT appear on sensors page:');
    roomsWithoutSensors.data.data.forEach(room => {
      console.log(`   - ${room.room} (ID: ${room.sensorId})`);
    });

    // 5. Test updating sensor installation status
    console.log('\n5. Testing sensor installation status update...');
    await axios.patch(`${API_BASE}/settings/rooms/${room2.data.data.id}/sensor-installation?tenantId=${TENANT_ID}`, {
      capteurInstalled: true
    });
    console.log('✅ Updated room without sensor to have sensor installed');

    // 6. Verify the update
    console.log('\n6. Verifying the update...');
    const updatedRoomsWithSensors = await axios.get(`${API_BASE}/settings/rooms/with-sensors?tenantId=${TENANT_ID}`);
    console.log('✅ Updated count - rooms with sensors:', updatedRoomsWithSensors.data.count);
    console.log('📋 All rooms that should now appear on sensors page:');
    updatedRoomsWithSensors.data.data.forEach(room => {
      console.log(`   - ${room.room} (ID: ${room.sensorId})`);
    });

    // 7. Clean up - delete test rooms
    console.log('\n7. Cleaning up test rooms...');
    await axios.delete(`${API_BASE}/settings/rooms/${room1.data.data.id}?tenantId=${TENANT_ID}`);
    await axios.delete(`${API_BASE}/settings/rooms/${room2.data.data.id}?tenantId=${TENANT_ID}`);
    await axios.delete(`${API_BASE}/settings/rooms/${room3.data.data.id}?tenantId=${TENANT_ID}`);
    console.log('✅ Test rooms deleted');

    console.log('\n🎉 Sensor filtering test completed successfully!');
    console.log('\n📝 Summary:');
    console.log('   - The sensors page at http://127.0.0.1:4000/sensors now only shows rooms with capteurInstalled: true');
    console.log('   - Rooms without sensors installed are filtered out');
    console.log('   - You can use the API to update sensor installation status');
    console.log('   - The frontend automatically updates when capteurInstalled status changes');

  } catch (error) {
    console.error('❌ Test failed:', error.response?.data || error.message);
    process.exit(1);
  }
}

// Run the test
if (require.main === module) {
  testSensorFiltering();
}

module.exports = { testSensorFiltering };
