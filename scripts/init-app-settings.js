const { initializeApp } = require('firebase/app');
const { getFirestore, doc, setDoc } = require('firebase/firestore');

// Configuration Firebase (utilisez vos propres clés)
const firebaseConfig = {
  // Ajoutez votre configuration Firebase ici
  apiKey: "your-api-key",
  authDomain: "your-project.firebaseapp.com",
  projectId: "your-project-id",
  storageBucket: "your-project.appspot.com",
  messagingSenderId: "123456789",
  appId: "your-app-id"
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
async function initAppSettings(tenantId) {
  try {
    console.log(`Initialisation des paramètres pour le tenant: ${tenantId}`);
    
    const docRef = doc(db, 'tenants', tenantId, 'settings', 'app');
    await setDoc(docRef, defaultAppSettings, { merge: true });
    
    console.log('✅ Paramètres initialisés avec succès!');
    console.log('Paramètres:', defaultAppSettings);
    
  } catch (error) {
    console.error('❌ Erreur lors de l\'initialisation des paramètres:', error);
  }
}

// Fonction pour mettre à jour les paramètres
async function updateAppSettings(tenantId, newSettings) {
  try {
    console.log(`Mise à jour des paramètres pour le tenant: ${tenantId}`);
    
    const docRef = doc(db, 'tenants', tenantId, 'settings', 'app');
    await setDoc(docRef, newSettings, { merge: true });
    
    console.log('✅ Paramètres mis à jour avec succès!');
    console.log('Nouveaux paramètres:', newSettings);
    
  } catch (error) {
    console.error('❌ Erreur lors de la mise à jour des paramètres:', error);
  }
}

// Exporter les fonctions
module.exports = {
  initAppSettings,
  updateAppSettings,
  defaultAppSettings
};

// Si le script est exécuté directement
if (require.main === module) {
  const tenantId = process.argv[2];
  
  if (!tenantId) {
    console.error('❌ Veuillez fournir un tenant ID');
    console.log('Usage: node init-app-settings.js <tenant-id>');
    process.exit(1);
  }
  
  initAppSettings(tenantId).then(() => {
    console.log('Script terminé');
    process.exit(0);
  });
}
