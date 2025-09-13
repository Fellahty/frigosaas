// Seed data script for Firestore
// This will create data in your real Firebase project

import { initializeApp } from 'firebase/app';
import { getFirestore, doc, setDoc, Timestamp } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyCe3hB-6TJKih-y_kI0x9x3aMZqX11OCtE",
  authDomain: "frigosaas.firebaseapp.com",
  projectId: "frigosaas",
  storageBucket: "frigosaas.firebasestorage.app",
  messagingSenderId: "492996777399",
  appId: "1:492996777399:web:34ae73d6480b4ecc8f4432",
  measurementId: "G-EQXGX4E44W"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Note: This will connect to your real Firebase project, not emulators
console.log('Connecting to Firebase project: frigosaas');

const sampleData = {
  tenantId: "YAZAMI",
  date: new Date().toISOString().split('T')[0],
  kpis: {
    totalRooms: 5,
    totalClients: 12,
    averageTemperature: 22.5,
    averageHumidity: 45.2,
    alertsCount: 3
  },
  rooms: [
    {
      id: "room-1",
      name: "Salle A",
      capacity: 20,
      currentOccupancy: 15,
      temperature: 22.0,
      humidity: 45.0
    },
    {
      id: "room-2",
      name: "Salle B",
      capacity: 15,
      currentOccupancy: 12,
      temperature: 23.5,
      humidity: 47.0
    },
    {
      id: "room-3",
      name: "Salle C",
      capacity: 25,
      currentOccupancy: 18,
      temperature: 21.8,
      humidity: 43.5
    },
    {
      id: "room-4",
      name: "Salle D",
      capacity: 18,
      currentOccupancy: 10,
      temperature: 24.2,
      humidity: 48.0
    },
    {
      id: "room-5",
      name: "Salle E",
      capacity: 30,
      currentOccupancy: 25,
      temperature: 22.8,
      humidity: 46.5
    }
  ],
  alerts: [
    {
      id: "alert-1",
      type: "warning",
      message: "Temperature slightly high in Salle B",
      timestamp: Timestamp.fromDate(new Date(Date.now() - 2 * 60 * 60 * 1000)), // 2 hours ago
      roomId: "room-2"
    },
    {
      id: "alert-2",
      type: "info",
      message: "Maintenance scheduled for Salle C tomorrow",
      timestamp: Timestamp.fromDate(new Date(Date.now() - 4 * 60 * 60 * 1000)), // 4 hours ago
      roomId: "room-3"
    },
    {
      id: "alert-3",
      type: "error",
      message: "Humidity sensor malfunction in Salle D",
      timestamp: Timestamp.fromDate(new Date(Date.now() - 1 * 60 * 60 * 1000)), // 1 hour ago
      roomId: "room-4"
    }
  ],
  topClients: [
    {
      id: "client-1",
      name: "Tech Solutions Inc",
      usage: 45,
      lastVisit: Timestamp.fromDate(new Date(Date.now() - 2 * 60 * 60 * 1000))
    },
    {
      id: "client-2",
      name: "Design Studio Pro",
      usage: 38,
      lastVisit: Timestamp.fromDate(new Date(Date.now() - 4 * 60 * 60 * 1000))
    },
    {
      id: "client-3",
      name: "Marketing Experts",
      usage: 32,
      lastVisit: Timestamp.fromDate(new Date(Date.now() - 6 * 60 * 60 * 1000))
    },
    {
      id: "client-4",
      name: "Consulting Group",
      usage: 28,
      lastVisit: Timestamp.fromDate(new Date(Date.now() - 8 * 60 * 60 * 1000))
    },
    {
      id: "client-5",
      name: "Innovation Labs",
      usage: 25,
      lastVisit: Timestamp.fromDate(new Date(Date.now() - 10 * 60 * 60 * 1000))
    }
  ],
  recentMoves: [
    {
      id: "move-1",
      clientId: "client-1",
      clientName: "Tech Solutions Inc",
      fromRoom: "Salle A",
      toRoom: "Salle B",
      timestamp: Timestamp.fromDate(new Date(Date.now() - 30 * 60 * 1000)), // 30 minutes ago
      reason: "Better equipment availability"
    },
    {
      id: "move-2",
      clientId: "client-2",
      clientName: "Design Studio Pro",
      fromRoom: "Salle C",
      toRoom: "Salle A",
      timestamp: Timestamp.fromDate(new Date(Date.now() - 45 * 60 * 1000)), // 45 minutes ago
      reason: "Room temperature adjustment"
    },
    {
      id: "move-3",
      clientId: "client-3",
      clientName: "Marketing Experts",
      fromRoom: "Salle D",
      toRoom: "Salle E",
      timestamp: Timestamp.fromDate(new Date(Date.now() - 1 * 60 * 60 * 1000)), // 1 hour ago
      reason: "Larger capacity needed"
    }
  ],
  lastUpdated: Timestamp.fromDate(new Date())
};

async function seedData() {
  try {
    console.log('🌱 Seeding Firebase project with sample data...');
    console.log('📊 Creating metrics_today/YAZAMI document...');
    
    // Create metrics_today document
    await setDoc(doc(db, 'metrics_today', 'YAZAMI'), sampleData);
    console.log('✅ Created metrics_today/YAZAMI document');
    
    console.log('👥 Creating sample clients...');
    // Create some sample clients
    const clientsData = [
      {
        name: "Tech Solutions Inc",
        email: "contact@techsolutions.com",
        phone: "+212 5 22 34 56 78",
        company: "Tech Solutions Inc",
        createdAt: Timestamp.fromDate(new Date('2024-01-15')),
        lastVisit: Timestamp.fromDate(new Date(Date.now() - 2 * 60 * 60 * 1000))
      },
      {
        name: "Design Studio Pro",
        email: "hello@designstudiopro.com",
        phone: "+212 6 12 34 56 78",
        company: "Design Studio Pro",
        createdAt: Timestamp.fromDate(new Date('2024-01-10')),
        lastVisit: Timestamp.fromDate(new Date(Date.now() - 4 * 60 * 60 * 1000))
      },
      {
        name: "Marketing Experts",
        email: "info@marketingexperts.com",
        phone: "+212 7 12 34 56 78",
        company: "Marketing Experts",
        createdAt: Timestamp.fromDate(new Date('2024-01-05')),
        lastVisit: Timestamp.fromDate(new Date(Date.now() - 6 * 60 * 60 * 1000))
      }
    ];
    
    for (let i = 0; i < clientsData.length; i++) {
      await setDoc(doc(db, 'clients', `client-${i + 1}`), clientsData[i]);
      console.log(`✅ Created client: ${clientsData[i].name}`);
    }
    
    console.log('🎉 Seeding completed successfully!');
    console.log('🚀 You can now run the application and see the sample data.');
    console.log('📱 Go to: http://127.0.0.1:3000/');
    
  } catch (error) {
    console.error('❌ Error seeding data:', error);
    console.error('💡 Make sure your Firebase project has Firestore enabled');
    console.error('💡 Check if you have the right permissions');
  }
}

// Run the seed function
seedData();
