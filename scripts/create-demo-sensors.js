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
    
    const roomId = 'DUWIZV3UF36b29H4tw1Z';
    const roomName = 'T1';
    const tenantId = 'YAZAMI';
    
    // Create temperature sensor
    const tempSensor = await addDoc(collection(db, 'sensors'), {
      roomId: roomId,
      roomName: roomName,
      tenantId: tenantId,
      type: 'temperature',
      name: 'Capteur de température T1',
      status: 'active',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    
    console.log('✅ Temperature sensor created:', tempSensor.id);
    
    // Create humidity sensor
    const humiditySensor = await addDoc(collection(db, 'sensors'), {
      roomId: roomId,
      roomName: roomName,
      tenantId: tenantId,
      type: 'humidity',
      name: 'Capteur d\'humidité T1',
      status: 'active',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    
    console.log('✅ Humidity sensor created:', humiditySensor.id);
    
    // Create pressure sensor
    const pressureSensor = await addDoc(collection(db, 'sensors'), {
      roomId: roomId,
      roomName: roomName,
      tenantId: tenantId,
      type: 'pressure',
      name: 'Capteur de pression T1',
      status: 'active',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    
    console.log('✅ Pressure sensor created:', pressureSensor.id);
    
    // Create some demo readings for each sensor
    const sensors = [
      { id: tempSensor.id, type: 'temperature', baseValue: 4.5 },
      { id: humiditySensor.id, type: 'humidity', baseValue: 65.2 },
      { id: pressureSensor.id, type: 'pressure', baseValue: 1013.25 }
    ];
    
    for (const sensor of sensors) {
      // Create 10 demo readings over the last 24 hours
      for (let i = 0; i < 10; i++) {
        const hoursAgo = i * 2.4; // Spread over 24 hours
        const timestamp = new Date(Date.now() - (hoursAgo * 60 * 60 * 1000));
        
        // Add some variation to the values
        const variation = (Math.random() - 0.5) * 2; // ±1 variation
        const value = sensor.baseValue + variation;
        
        await addDoc(collection(db, 'sensor_readings'), {
          sensorId: sensor.id,
          roomId: roomId,
          roomName: roomName,
          tenantId: tenantId,
          type: sensor.type,
          value: Math.round(value * 10) / 10, // Round to 1 decimal
          timestamp: timestamp,
          createdAt: serverTimestamp()
        });
      }
      
      console.log(`✅ Created 10 readings for ${sensor.type} sensor`);
    }
    
    console.log('🎉 Demo sensors and readings created successfully!');
    console.log('📊 Summary:');
    console.log(`- Room: ${roomName} (${roomId})`);
    console.log(`- Sensors: 3 (temperature, humidity, pressure)`);
    console.log(`- Readings: 30 (10 per sensor)`);
    
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
