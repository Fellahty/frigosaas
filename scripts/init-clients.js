// Script pour initialiser des clients de test
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, addDoc, getDocs, query, doc, setDoc } from 'firebase/firestore';

// Configuration Firebase
const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY || "your-api-key",
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN || "your-project.firebaseapp.com",
  projectId: process.env.VITE_FIREBASE_PROJECT_ID || "your-project-id",
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET || "your-project.appspot.com",
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "123456789",
  appId: process.env.VITE_FIREBASE_APP_ID || "your-app-id"
};

// Initialiser Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Données de test pour les clients
const testClients = [
  {
    name: 'Ahmed Benali',
    email: 'ahmed.benali@example.com',
    phone: '+212 6 12 34 56 78',
    company: 'Fruits & Légumes SARL',
    reservedCrates: 150,
    requiresEmptyCrates: true,
    createdAt: new Date('2024-01-15'),
    lastVisit: new Date('2024-01-20'),
  },
  {
    name: 'Fatima Zahra',
    email: 'fatima.zahra@example.com',
    phone: '+212 6 23 45 67 89',
    company: 'Marché Central',
    reservedCrates: 75,
    requiresEmptyCrates: false,
    createdAt: new Date('2024-01-10'),
    lastVisit: new Date('2024-01-18'),
  },
  {
    name: 'Mohammed Alami',
    email: 'mohammed.alami@example.com',
    phone: '+212 6 34 56 78 90',
    company: 'Distributions Alami',
    reservedCrates: 200,
    requiresEmptyCrates: true,
    createdAt: new Date('2024-01-05'),
    lastVisit: new Date('2024-01-19'),
  },
  {
    name: 'Aicha Mansouri',
    email: 'aicha.mansouri@example.com',
    phone: '+212 6 45 67 89 01',
    company: 'Super Marché Aicha',
    reservedCrates: 100,
    requiresEmptyCrates: true,
    createdAt: new Date('2024-01-12'),
    lastVisit: new Date('2024-01-17'),
  },
  {
    name: 'Hassan Tazi',
    email: 'hassan.tazi@example.com',
    phone: '+212 6 56 78 90 12',
    company: 'Tazi Distribution',
    reservedCrates: 50,
    requiresEmptyCrates: false,
    createdAt: new Date('2024-01-08'),
    lastVisit: new Date('2024-01-16'),
  }
];

async function checkClientsCollection(tenantId) {
  try {
    console.log(`🔍 Vérification de la collection clients pour le tenant: ${tenantId}`);
    
    const clientsRef = collection(db, 'tenants', tenantId, 'clients');
    const querySnapshot = await getDocs(clientsRef);
    
    console.log(`📊 Nombre de clients existants: ${querySnapshot.docs.length}`);
    
    if (querySnapshot.docs.length > 0) {
      console.log('✅ Des clients existent déjà:');
      querySnapshot.docs.forEach((doc, index) => {
        const data = doc.data();
        console.log(`   ${index + 1}. ${data.name} (${data.email})`);
      });
    } else {
      console.log('⚠️  Aucun client trouvé dans la collection');
    }
    
    return querySnapshot.docs.length;
    
  } catch (error) {
    console.error('❌ Erreur lors de la vérification:', error);
    return 0;
  }
}

async function initClients(tenantId) {
  try {
    console.log(`🚀 Initialisation des clients pour le tenant: ${tenantId}`);
    
    // Vérifier d'abord s'il y a déjà des clients
    const existingCount = await checkClientsCollection(tenantId);
    
    if (existingCount > 0) {
      console.log('⚠️  Des clients existent déjà. Voulez-vous les remplacer ?');
      console.log('Pour continuer, relancez avec --force');
      return;
    }
    
    // Ajouter les clients de test
    const clientsRef = collection(db, 'tenants', tenantId, 'clients');
    const addedClients = [];
    
    for (const clientData of testClients) {
      try {
        const docRef = await addDoc(clientsRef, {
          ...clientData,
          createdAt: clientData.createdAt,
          lastVisit: clientData.lastVisit,
        });
        
        addedClients.push({
          id: docRef.id,
          ...clientData
        });
        
        console.log(`✅ Client ajouté: ${clientData.name}`);
      } catch (error) {
        console.error(`❌ Erreur lors de l'ajout de ${clientData.name}:`, error);
      }
    }
    
    console.log(`🎉 ${addedClients.length} clients ajoutés avec succès!`);
    
    // Vérifier le résultat
    await checkClientsCollection(tenantId);
    
  } catch (error) {
    console.error('❌ Erreur lors de l\'initialisation des clients:', error);
  }
}

async function clearClients(tenantId) {
  try {
    console.log(`🗑️  Suppression de tous les clients pour le tenant: ${tenantId}`);
    
    const clientsRef = collection(db, 'tenants', tenantId, 'clients');
    const querySnapshot = await getDocs(clientsRef);
    
    console.log(`📊 ${querySnapshot.docs.length} clients à supprimer`);
    
    // Note: Pour supprimer en masse, il faudrait utiliser une fonction Cloud Function
    // ou supprimer un par un (ce qui peut être coûteux)
    console.log('⚠️  La suppression en masse nécessite une fonction Cloud Function');
    console.log('Pour supprimer manuellement, utilisez la console Firebase');
    
  } catch (error) {
    console.error('❌ Erreur lors de la suppression:', error);
  }
}

// Fonction principale
async function main() {
  const command = process.argv[2];
  const tenantId = process.argv[3];
  const force = process.argv.includes('--force');
  
  if (!tenantId) {
    console.error('❌ Veuillez fournir un tenant ID');
    console.log('Usage:');
    console.log('  node init-clients.js check <tenant-id>     # Vérifier les clients existants');
    console.log('  node init-clients.js init <tenant-id>      # Initialiser les clients');
    console.log('  node init-clients.js init <tenant-id> --force  # Forcer l\'initialisation');
    console.log('  node init-clients.js clear <tenant-id>     # Supprimer tous les clients');
    process.exit(1);
  }
  
  switch (command) {
    case 'check':
      await checkClientsCollection(tenantId);
      break;
    case 'init':
      if (force) {
        console.log('🔄 Mode force activé - initialisation forcée');
      }
      await initClients(tenantId);
      break;
    case 'clear':
      await clearClients(tenantId);
      break;
    default:
      console.error('❌ Commande invalide. Utilisez "check", "init" ou "clear"');
      process.exit(1);
  }
  
  console.log('🏁 Script terminé');
  process.exit(0);
}

// Exécuter le script
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export {
  initClients,
  checkClientsCollection,
  clearClients,
  testClients
};
