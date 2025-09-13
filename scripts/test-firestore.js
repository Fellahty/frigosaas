// Script pour tester la connexion Firestore
const { initializeApp } = require('firebase/app');
const { getFirestore, doc, getDoc, setDoc } = require('firebase/firestore');

// Configuration Firebase
const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY || "your-api-key",
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN || "your-project.firebaseapp.com",
  projectId: process.env.VITE_FIREBASE_PROJECT_ID || "your-project-id",
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET || "your-project.appspot.com",
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "123456789",
  appId: process.env.VITE_FIREBASE_APP_ID || "your-app-id"
};

async function testFirestoreConnection() {
  try {
    console.log('🚀 Test de connexion Firestore...');
    console.log('Configuration:', {
      projectId: firebaseConfig.projectId,
      authDomain: firebaseConfig.authDomain
    });

    // Initialiser Firebase
    const app = initializeApp(firebaseConfig);
    const db = getFirestore(app);
    
    console.log('✅ Firebase initialisé avec succès');

    // Test de lecture
    const testDocRef = doc(db, 'test', 'connection');
    console.log('📖 Test de lecture...');
    
    try {
      const docSnap = await getDoc(testDocRef);
      if (docSnap.exists()) {
        console.log('✅ Lecture réussie:', docSnap.data());
      } else {
        console.log('⚠️  Document de test n\'existe pas, création...');
      }
    } catch (readError) {
      console.log('⚠️  Erreur de lecture (normal si le document n\'existe pas):', readError.message);
    }

    // Test d'écriture
    console.log('📝 Test d\'écriture...');
    const testData = {
      timestamp: new Date().toISOString(),
      message: 'Test de connexion Firestore',
      status: 'success'
    };
    
    await setDoc(testDocRef, testData);
    console.log('✅ Écriture réussie');

    // Vérification
    console.log('🔍 Vérification...');
    const verifySnap = await getDoc(testDocRef);
    if (verifySnap.exists()) {
      console.log('✅ Vérification réussie:', verifySnap.data());
    } else {
      console.log('❌ Vérification échouée');
    }

    console.log('🎉 Test de connexion Firestore réussi!');

  } catch (error) {
    console.error('❌ Erreur lors du test de connexion:', error);
    console.error('Détails:', error.message);
    
    if (error.code) {
      console.error('Code d\'erreur:', error.code);
    }
    
    if (error.message.includes('permission')) {
      console.error('💡 Suggestion: Vérifiez les règles de sécurité Firestore');
    }
    
    if (error.message.includes('network')) {
      console.error('💡 Suggestion: Vérifiez votre connexion internet');
    }
    
    if (error.message.includes('config')) {
      console.error('💡 Suggestion: Vérifiez votre configuration Firebase');
    }
  }
}

// Exécuter le test
if (require.main === module) {
  testFirestoreConnection().then(() => {
    console.log('🏁 Test terminé');
    process.exit(0);
  }).catch((error) => {
    console.error('💥 Erreur fatale:', error);
    process.exit(1);
  });
}

module.exports = { testFirestoreConnection };
