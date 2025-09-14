const { initializeApp } = require('firebase/app');
const { getFirestore, collection, addDoc, serverTimestamp } = require('firebase/firestore');

// Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyBvOkBwJ1B3Q4R5S6T7U8V9W0X1Y2Z3A4B5C",
  authDomain: "frigo-saas.firebaseapp.com",
  projectId: "frigo-saas",
  storageBucket: "frigo-saas.appspot.com",
  messagingSenderId: "123456789012",
  appId: "1:123456789012:web:abcdef1234567890"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function createDemoSensors() {
  try {
    console.log('🚀 Creating demo sensors...');
    
    const tenantId = 'YAZAMI';
    
    // First, get all existing rooms
    const { getDocs, query, where } = require('firebase/firestore');
    const roomsQuery = query(collection(db, 'rooms'), where('tenantId', '==', tenantId));
    const roomsSnapshot = await getDocs(roomsQuery);
    
    console.log(`📦 Found ${roomsSnapshot.docs.length} existing rooms`);
    
    if (roomsSnapshot.docs.length === 0) {
      console.log('❌ No rooms found. Please create rooms first.');
      return;
    }
    
    const rooms = roomsSnapshot.docs.map(doc => ({
      id: doc.id,
      name: doc.data().room || `Room ${doc.id}`,
      data: doc.data()
    }));
    
    console.log('🏠 Existing rooms:', rooms.map(r => `${r.name} (${r.id})`));
    
    const allSensors = [];
    
    // Create sensors for each room
    for (const room of rooms) {
      console.log(`\n🔧 Creating sensors for room: ${room.name} (${room.id})`);
      
      // Create temperature sensor
      const tempSensor = await addDoc(collection(db, 'sensors'), {
        roomId: room.id,
        roomName: room.name,
        tenantId: tenantId,
        type: 'temperature',
        name: room.name, // Use room name as sensor name
        status: 'active',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      
      console.log('✅ Temperature sensor created:', tempSensor.id);
      
      // Create humidity sensor
      const humiditySensor = await addDoc(collection(db, 'sensors'), {
        roomId: room.id,
        roomName: room.name,
        tenantId: tenantId,
        type: 'humidity',
        name: room.name, // Use room name as sensor name
        status: 'active',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      
      console.log('✅ Humidity sensor created:', humiditySensor.id);
      
      // Create pressure sensor
      const pressureSensor = await addDoc(collection(db, 'sensors'), {
        roomId: room.id,
        roomName: room.name,
        tenantId: tenantId,
        type: 'pressure',
        name: room.name, // Use room name as sensor name
        status: 'active',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      
      console.log('✅ Pressure sensor created:', pressureSensor.id);
      
      // Add to all sensors list
      allSensors.push(
        { id: tempSensor.id, type: 'temperature', baseValue: 4.5, roomName: room.name },
        { id: humiditySensor.id, type: 'humidity', baseValue: 65.2, roomName: room.name },
        { id: pressureSensor.id, type: 'pressure', baseValue: 1013.25, roomName: room.name }
      );
    }
    
    console.log(`\n📊 Creating demo readings for ${allSensors.length} sensors...`);
    
    // Create demo readings for all sensors
    for (const sensor of allSensors) {
      // Create 10 demo readings over the last 24 hours
      for (let i = 0; i < 10; i++) {
        const hoursAgo = i * 2.4; // Spread over 24 hours
        const timestamp = new Date(Date.now() - (hoursAgo * 60 * 60 * 1000));
        
        // Add some variation to the values
        const variation = (Math.random() - 0.5) * 2; // ±1 variation
        const value = sensor.baseValue + variation;
        
        const room = rooms.find(r => r.name === sensor.roomName);
        await addDoc(collection(db, 'sensor_readings'), {
          sensorId: sensor.id,
          roomId: room?.id,
          roomName: sensor.roomName,
          tenantId: tenantId,
          type: sensor.type,
          value: Math.round(value * 10) / 10, // Round to 1 decimal
          timestamp: timestamp,
          createdAt: serverTimestamp()
        });
      }
      
      console.log(`✅ Created 10 readings for ${sensor.type} sensor in ${sensor.roomName}`);
    }
    
    console.log('\n🎉 Demo sensors and readings created successfully!');
    console.log('📊 Summary:');
    console.log(`- Rooms: ${rooms.length} (${rooms.map(r => r.name).join(', ')})`);
    console.log(`- Sensors: ${allSensors.length} (3 per room: temperature, humidity, pressure)`);
    console.log(`- Readings: ${allSensors.length * 10} (10 per sensor)`);
    
  } catch (error) {
    console.error('❌ Error creating demo sensors:', error);
  }
}

// Run the script
createDemoSensors().then(() => {
  console.log('✅ Script completed');
  process.exit(0);
}).catch((error) => {
  console.error('❌ Script failed:', error);
  process.exit(1);
});
