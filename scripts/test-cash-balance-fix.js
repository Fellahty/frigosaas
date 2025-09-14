const { initializeApp } = require('firebase/app');
const { getFirestore, doc, setDoc, getDoc } = require('firebase/firestore');

// Configuration Firebase (remplacez par vos clés)
const firebaseConfig = {
  // Vos clés de configuration Firebase
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function testCashBalanceFix() {
  try {
    const tenantId = 'test-tenant'; // Remplacez par un tenant ID valide
    
    console.log('🔧 Test de correction du solde initial de la caisse...\n');
    
    // 1. Vérifier le chemin Firestore correct
    console.log('1️⃣ Vérification du chemin Firestore...');
    const correctPath = `tenants/${tenantId}/settings/site`;
    console.log('   Chemin correct:', correctPath);
    
    // 2. Configurer un solde initial
    console.log('\n2️⃣ Configuration du solde initial...');
    const generalSettings = {
      name: 'Test Frigo',
      currency: 'MAD',
      locale: 'fr',
      capacity_unit: 'caisses',
      initial_cash_balance: 2500.00, // 2500 MAD de solde initial
      season: {
        from: '2024-01-01',
        to: '2024-12-31'
      }
    };

    await setDoc(doc(db, 'tenants', tenantId, 'settings', 'site'), generalSettings);
    console.log('   ✅ Solde initial configuré: 2500 MAD');
    console.log('   📍 Chemin: tenants/' + tenantId + '/settings/site');

    // 3. Vérifier que le solde initial est bien récupéré
    console.log('\n3️⃣ Vérification de la récupération...');
    const docRef = doc(db, 'tenants', tenantId, 'settings', 'site');
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists()) {
      const data = docSnap.data();
      console.log('   ✅ Document trouvé');
      console.log('   📊 Données récupérées:', JSON.stringify(data, null, 2));
      console.log('   💰 Solde initial récupéré:', data.initial_cash_balance, 'MAD');
      
      // 4. Simuler le calcul du solde actuel
      console.log('\n4️⃣ Simulation du calcul du solde actuel...');
      const initialBalance = data.initial_cash_balance || 0;
      const todayReceipts = 800; // Simuler des encaissements
      const todayPayments = 300; // Simuler des décaissements
      
      const currentBalance = initialBalance + todayReceipts - todayPayments;
      
      console.log('   📈 Calcul du solde:');
      console.log('      - Solde initial:', initialBalance, 'MAD');
      console.log('      - Encaissements:', todayReceipts, 'MAD');
      console.log('      - Décaissements:', todayPayments, 'MAD');
      console.log('      - Solde actuel:', currentBalance, 'MAD');
      
      if (currentBalance === 3000) {
        console.log('\n✅ Test réussi! Le solde initial est correctement utilisé.');
        console.log('   Le solde actuel (3000 MAD) = Solde initial (2500 MAD) + Encaissements (800 MAD) - Décaissements (300 MAD)');
      } else {
        console.log('\n❌ Test échoué! Le calcul du solde est incorrect.');
        console.log('   Attendu: 3000 MAD, Obtenu:', currentBalance, 'MAD');
      }
    } else {
      console.log('   ❌ Document non trouvé dans tenants/' + tenantId + '/settings/site');
    }

    // 5. Instructions pour tester dans l'interface
    console.log('\n5️⃣ Instructions pour tester dans l\'interface:');
    console.log('   1. Ouvrez la page Caisse dans l\'application');
    console.log('   2. Vérifiez que le solde actuel affiche 3000 MAD (ou plus si il y a d\'autres mouvements)');
    console.log('   3. Vérifiez que "Solde initial: 2500 MAD" apparaît sous le solde actuel');
    console.log('   4. Ouvrez la console du navigateur pour voir les logs de debug');

  } catch (error) {
    console.error('❌ Erreur lors du test:', error);
  }
}

// Exécuter le test
testCashBalanceFix();
