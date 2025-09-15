const { initializeApp } = require('firebase/app');
const { getFirestore, collection, addDoc, serverTimestamp } = require('firebase/firestore');

// Firebase configuration
const firebaseConfig = {
  // Add your Firebase config here
  apiKey: "your-api-key",
  authDomain: "your-project.firebaseapp.com",
  projectId: "your-project-id",
  storageBucket: "your-project.appspot.com",
  messagingSenderId: "123456789",
  appId: "your-app-id"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Default crate types
const defaultCrateTypes = [
  {
    name: 'Caisse Standard',
    type: 'plastic',
    color: 'blue',
    customName: 'Caisse pommes',
    depositAmount: 50,
    isActive: true
  },
  {
    name: 'Caisse Premium',
    type: 'wood',
    color: 'brown',
    customName: 'Caisse bois pommes',
    depositAmount: 100,
    isActive: true
  },
  {
    name: 'Caisse Légère',
    type: 'plastic',
    color: 'green',
    customName: 'Caisse légère',
    depositAmount: 30,
    isActive: true
  },
  {
    name: 'Caisse Renforcée',
    type: 'plastic',
    color: 'red',
    customName: 'Caisse renforcée',
    depositAmount: 75,
    isActive: true
  },
  {
    name: 'Caisse Spéciale',
    type: 'wood',
    color: 'gray',
    customName: 'Caisse spéciale bois',
    depositAmount: 150,
    isActive: true
  }
];

async function initCrateTypes(tenantId) {
  try {
    console.log(`Initializing crate types for tenant: ${tenantId}`);
    
    for (const crateType of defaultCrateTypes) {
      await addDoc(collection(db, 'tenants', tenantId, 'crate-types'), {
        ...crateType,
        createdAt: serverTimestamp()
      });
      console.log(`Added crate type: ${crateType.customName || crateType.name}`);
    }
    
    console.log('Crate types initialized successfully!');
  } catch (error) {
    console.error('Error initializing crate types:', error);
  }
}

// Get tenant ID from command line argument
const tenantId = process.argv[2];
if (!tenantId) {
  console.error('Please provide tenant ID as argument: node init-crate-types.js <tenant-id>');
  process.exit(1);
}

initCrateTypes(tenantId);
