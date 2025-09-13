import { initializeApp } from 'firebase/app';
import { getFirestore, collection, addDoc, serverTimestamp } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyBvOkBwJ1Z4Z4Z4Z4Z4Z4Z4Z4Z4Z4Z4Z4Z4",
  authDomain: "frigosaas.firebaseapp.com",
  projectId: "frigosaas",
  storageBucket: "frigosaas.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abcdef123456789"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const sampleLogs = [
  {
    userId: 'admin',
    userName: 'Administrateur',
    action: 'create',
    resource: 'client',
    resourceId: 'client_001',
    details: 'Client created: Société ABC',
    tenantId: 'YAZAMI',
    ipAddress: '192.168.1.100',
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
  },
  {
    userId: 'admin',
    userName: 'Administrateur',
    action: 'update',
    resource: 'room',
    resourceId: 'room_001',
    details: 'Room capacity updated from 1000 to 1500 crates',
    tenantId: 'YAZAMI',
    ipAddress: '192.168.1.100',
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
  },
  {
    userId: 'manager',
    userName: 'Manager YAZAMI',
    action: 'create',
    resource: 'invoice',
    resourceId: 'invoice_001',
    details: 'Invoice created for Client XYZ - Amount: 2500 MAD',
    tenantId: 'YAZAMI',
    ipAddress: '192.168.1.101',
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
  },
  {
    userId: 'admin',
    userName: 'Administrateur',
    action: 'delete',
    resource: 'user',
    resourceId: 'user_003',
    details: 'User account deleted: old_manager@example.com',
    tenantId: 'YAZAMI',
    ipAddress: '192.168.1.100',
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
  },
  {
    userId: 'manager',
    userName: 'Manager YAZAMI',
    action: 'update',
    resource: 'settings',
    resourceId: 'pricing',
    details: 'Pricing settings updated - Crate price: 25 MAD',
    tenantId: 'YAZAMI',
    ipAddress: '192.168.1.101',
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
  },
  {
    userId: 'admin',
    userName: 'Administrateur',
    action: 'login',
    resource: 'user',
    resourceId: 'admin',
    details: 'User logged in successfully',
    tenantId: 'YAZAMI',
    ipAddress: '192.168.1.100',
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
  },
  {
    userId: 'manager',
    userName: 'Manager YAZAMI',
    action: 'create',
    resource: 'loan',
    resourceId: 'loan_001',
    details: 'Empty crate loan created for Client ABC - 50 crates, 500 MAD deposit',
    tenantId: 'YAZAMI',
    ipAddress: '192.168.1.101',
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
  },
  {
    userId: 'admin',
    userName: 'Administrateur',
    action: 'update',
    resource: 'cash',
    resourceId: 'cash_001',
    details: 'Cash entry added - Type: Entrée, Amount: 1000 MAD',
    tenantId: 'YAZAMI',
    ipAddress: '192.168.1.100',
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
  }
];

async function seedLogs() {
  try {
    console.log('Adding sample logs...');
    
    for (const log of sampleLogs) {
      await addDoc(collection(db, 'logs'), {
        ...log,
        timestamp: serverTimestamp()
      });
      console.log(`Added log: ${log.action} ${log.resource} by ${log.userName}`);
    }
    
    console.log('✅ Sample logs added successfully!');
  } catch (error) {
    console.error('❌ Error adding logs:', error);
  }
}

seedLogs();
