// Script to debug cash movements and client data
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, query, where, Timestamp } from 'firebase/firestore';

// Configuration Firebase
const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY || "your-api-key",
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN || "your-project.firebaseapp.com",
  projectId: process.env.VITE_FIREBASE_PROJECT_ID || "your-project-id",
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET || "your-project.appspot.com",
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "123456789",
  appId: process.env.VITE_FIREBASE_APP_ID || "your-app-id"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function debugCashMovements() {
  const tenantId = 'YAZAMI'; // Your tenant ID
  
  console.log('🔍 Debugging cash movements for tenant:', tenantId);
  console.log('='.repeat(50));
  
  try {
    // 1. Get all cash movements
    console.log('\n📊 CASH MOVEMENTS:');
    const cashMovementsQuery = query(
      collection(db, 'tenants', tenantId, 'cashMovements'),
      where('type', '==', 'in')
    );
    const cashMovementsSnapshot = await getDocs(cashMovementsQuery);
    
    console.log(`Total cash movements found: ${cashMovementsSnapshot.docs.length}`);
    
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    
    cashMovementsSnapshot.docs.forEach((doc, index) => {
      const data = doc.data();
      const createdAt = data.createdAt?.toDate ? data.createdAt.toDate() : new Date(data.createdAt);
      
      console.log(`\n💰 Movement ${index + 1}:`);
      console.log(`  ID: ${doc.id}`);
      console.log(`  Client ID: ${data.clientId || 'N/A'}`);
      console.log(`  Client Name: ${data.clientName || 'N/A'}`);
      console.log(`  Reason: ${data.reason || 'N/A'}`);
      console.log(`  Amount: ${data.amount || 'N/A'} MAD`);
      console.log(`  Payment Method: ${data.paymentMethod || 'N/A'}`);
      console.log(`  Reference: ${data.reference || 'N/A'}`);
      console.log(`  Created At: ${createdAt.toLocaleString('fr-FR')}`);
      console.log(`  Is Recent (last 7 days): ${createdAt >= sevenDaysAgo ? '✅' : '❌'}`);
    });
    
    // 2. Get all clients
    console.log('\n👥 CLIENTS:');
    const clientsQuery = query(collection(db, 'tenants', tenantId, 'clients'));
    const clientsSnapshot = await getDocs(clientsQuery);
    
    console.log(`Total clients found: ${clientsSnapshot.docs.length}`);
    
    clientsSnapshot.docs.forEach((doc, index) => {
      const data = doc.data();
      console.log(`\n👤 Client ${index + 1}:`);
      console.log(`  ID: ${doc.id}`);
      console.log(`  Name: ${data.name || 'N/A'}`);
      console.log(`  Email: ${data.email || 'N/A'}`);
      console.log(`  Phone: ${data.phone || 'N/A'}`);
      console.log(`  Company: ${data.company || 'N/A'}`);
    });
    
    // 3. Check for data inconsistencies
    console.log('\n🔍 DATA CONSISTENCY CHECK:');
    const recentMovements = cashMovementsSnapshot.docs
      .map(doc => ({ id: doc.id, ...doc.data() }))
      .filter(movement => {
        const createdAt = movement.createdAt?.toDate ? movement.createdAt.toDate() : new Date(movement.createdAt);
        return createdAt >= sevenDaysAgo;
      });
    
    const clientsMap = new Map();
    clientsSnapshot.docs.forEach(clientDoc => {
      const clientData = clientDoc.data();
      clientsMap.set(clientDoc.id, clientData.name);
    });
    
    console.log(`Recent movements (last 7 days): ${recentMovements.length}`);
    
    recentMovements.forEach((movement, index) => {
      console.log(`\n🔍 Checking Movement ${index + 1}:`);
      console.log(`  Movement Client ID: ${movement.clientId}`);
      console.log(`  Movement Client Name: ${movement.clientName}`);
      
      if (movement.clientId && clientsMap.has(movement.clientId)) {
        const actualClientName = clientsMap.get(movement.clientId);
        console.log(`  Actual Client Name in DB: ${actualClientName}`);
        
        if (movement.clientName !== actualClientName) {
          console.log(`  ⚠️  MISMATCH: Movement shows "${movement.clientName}" but client DB has "${actualClientName}"`);
        } else {
          console.log(`  ✅ Match: Movement and client DB are consistent`);
        }
      } else {
        console.log(`  ❌ ERROR: Client ID ${movement.clientId} not found in clients database`);
      }
    });
    
  } catch (error) {
    console.error('❌ Error debugging cash movements:', error);
  }
}

// Run the debug function
debugCashMovements().then(() => {
  console.log('\n✅ Debug completed');
  process.exit(0);
}).catch((error) => {
  console.error('❌ Debug failed:', error);
  process.exit(1);
});
