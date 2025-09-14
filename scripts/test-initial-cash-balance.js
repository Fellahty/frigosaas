const { initializeApp } = require('firebase/app');
const { getFirestore, doc, setDoc, getDoc } = require('firebase/firestore');

// Configuration Firebase (utilisez vos propres clés)
const firebaseConfig = {
  // Vos clés de configuration Firebase
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function testInitialCashBalance() {
  try {
    const tenantId = 'test-tenant'; // Remplacez par un tenant ID valide
    
    // 1. Définir un solde initial dans les paramètres généraux
    const generalSettings = {
      name: 'Test Frigo',
      currency: 'MAD',
      locale: 'fr',
      capacity_unit: 'caisses',
      initial_cash_balance: 1000.00, // 1000 MAD de solde initial
      season: {
        from: '2024-01-01',
        to: '2024-12-31'
      }
    };

    console.log('📝 Configuration du solde initial...');
    await setDoc(doc(db, 'tenants', tenantId, 'settings', 'general'), generalSettings);
    console.log('✅ Solde initial configuré: 1000 MAD');

    // 2. Vérifier que le solde initial est bien récupéré
    const docRef = doc(db, 'tenants', tenantId, 'settings', 'general');
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists()) {
      const data = docSnap.data();
      console.log('📊 Solde initial récupéré:', data.initial_cash_balance, 'MAD');
      
      // 3. Simuler le calcul du solde actuel
      const initialBalance = data.initial_cash_balance || 0;
      const todayReceipts = 500; // Simuler des encaissements
      const todayPayments = 200; // Simuler des décaissements
      
      const currentBalance = initialBalance + todayReceipts - todayPayments;
      
      console.log('💰 Calcul du solde actuel:');
      console.log('   - Solde initial:', initialBalance, 'MAD');
      console.log('   - Encaissements:', todayReceipts, 'MAD');
      console.log('   - Décaissements:', todayPayments, 'MAD');
      console.log('   - Solde actuel:', currentBalance, 'MAD');
      
      if (currentBalance === 1300) {
        console.log('✅ Test réussi! Le solde initial est correctement utilisé.');
      } else {
        console.log('❌ Test échoué! Le calcul du solde est incorrect.');
      }
    } else {
      console.log('❌ Impossible de récupérer les paramètres généraux');
    }

  } catch (error) {
    console.error('❌ Erreur lors du test:', error);
  }
}

// Exécuter le test
testInitialCashBalance();
