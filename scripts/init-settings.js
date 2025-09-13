// Script pour initialiser les paramètres par défaut
const { initializeApp } = require('firebase/app');
const { getFirestore, doc, setDoc, getDoc } = require('firebase/firestore');

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

// Paramètres par défaut
const defaultAppSettings = {
  // Date settings
  defaultEntryDate: new Date().toISOString().split('T')[0],
  defaultExitDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 30 days from now
  dateFormat: 'DD/MM/YYYY',
  
  // Business settings
  companyName: 'Frigo SaaS',
  currency: 'MAD',
  currencySymbol: 'د.م',
  
  // Notification settings
  emailNotifications: true,
  smsNotifications: false,
  
  // UI settings
  theme: 'light',
  language: 'fr',
  
  // Business rules
  maxReservationDays: 365,
  minDepositPercentage: 10,
  autoApproveReservations: false,
  
  // Storage settings
  maxFileSize: 10, // in MB
  allowedFileTypes: ['jpg', 'jpeg', 'png', 'gif', 'pdf'],
};

// Fonction pour initialiser les paramètres
async function initSettings(tenantId) {
  try {
    console.log(`🚀 Initialisation des paramètres pour le tenant: ${tenantId}`);
    
    // Vérifier si les paramètres existent déjà
    const docRef = doc(db, 'tenants', tenantId, 'settings', 'app');
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists()) {
      console.log('⚠️  Les paramètres existent déjà pour ce tenant');
      const existingData = docSnap.data();
      console.log('Paramètres existants:', existingData);
      
      // Demander confirmation pour écraser
      const readline = require('readline');
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
      });
      
      const answer = await new Promise((resolve) => {
        rl.question('Voulez-vous écraser les paramètres existants ? (y/N): ', resolve);
      });
      
      rl.close();
      
      if (answer.toLowerCase() !== 'y' && answer.toLowerCase() !== 'yes') {
        console.log('❌ Opération annulée');
        return;
      }
    }
    
    // Créer ou mettre à jour les paramètres
    await setDoc(docRef, defaultAppSettings, { merge: true });
    
    console.log('✅ Paramètres initialisés avec succès!');
    console.log('📋 Paramètres configurés:');
    console.log(JSON.stringify(defaultAppSettings, null, 2));
    
    // Vérifier que les paramètres ont été sauvegardés
    const verifySnap = await getDoc(docRef);
    if (verifySnap.exists()) {
      console.log('✅ Vérification: Les paramètres ont été sauvegardés correctement');
    } else {
      console.log('❌ Erreur: Les paramètres n\'ont pas été sauvegardés');
    }
    
  } catch (error) {
    console.error('❌ Erreur lors de l\'initialisation des paramètres:', error);
    console.error('Détails:', error.message);
  }
}

// Fonction pour lister les paramètres existants
async function listSettings(tenantId) {
  try {
    console.log(`📋 Paramètres pour le tenant: ${tenantId}`);
    
    const docRef = doc(db, 'tenants', tenantId, 'settings', 'app');
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists()) {
      const data = docSnap.data();
      console.log('✅ Paramètres trouvés:');
      console.log(JSON.stringify(data, null, 2));
    } else {
      console.log('❌ Aucun paramètre trouvé pour ce tenant');
    }
    
  } catch (error) {
    console.error('❌ Erreur lors de la récupération des paramètres:', error);
  }
}

// Fonction principale
async function main() {
  const command = process.argv[2];
  const tenantId = process.argv[3];
  
  if (!tenantId) {
    console.error('❌ Veuillez fournir un tenant ID');
    console.log('Usage:');
    console.log('  node init-settings.js init <tenant-id>  # Initialiser les paramètres');
    console.log('  node init-settings.js list <tenant-id>  # Lister les paramètres');
    process.exit(1);
  }
  
  switch (command) {
    case 'init':
      await initSettings(tenantId);
      break;
    case 'list':
      await listSettings(tenantId);
      break;
    default:
      console.error('❌ Commande invalide. Utilisez "init" ou "list"');
      process.exit(1);
  }
  
  console.log('🏁 Script terminé');
  process.exit(0);
}

// Exécuter le script
if (require.main === module) {
  main().catch(console.error);
}

module.exports = {
  initSettings,
  listSettings,
  defaultAppSettings
};
