#!/usr/bin/env node

// Script pour exécuter tous les tests de diagnostic
const { execSync } = require('child_process');
const path = require('path');

console.log('🚀 Démarrage des tests de diagnostic...\n');

const tests = [
  {
    name: 'Test de connexion Firestore',
    command: 'node scripts/test-firestore.js',
    description: 'Vérifie la connexion à Firestore'
  },
  {
    name: 'Test des paramètres',
    command: 'node scripts/init-settings.js list YAZAMI',
    description: 'Vérifie les paramètres existants'
  }
];

async function runTest(test) {
  try {
    console.log(`📋 ${test.name}...`);
    console.log(`   ${test.description}`);
    
    const result = execSync(test.command, { 
      encoding: 'utf8',
      cwd: process.cwd(),
      stdio: 'pipe'
    });
    
    console.log(`✅ ${test.name} - RÉUSSI`);
    if (result.trim()) {
      console.log(`   Résultat: ${result.trim()}`);
    }
    console.log('');
    
  } catch (error) {
    console.log(`❌ ${test.name} - ÉCHEC`);
    console.log(`   Erreur: ${error.message}`);
    if (error.stdout) {
      console.log(`   Sortie: ${error.stdout}`);
    }
    if (error.stderr) {
      console.log(`   Erreur: ${error.stderr}`);
    }
    console.log('');
  }
}

async function runAllTests() {
  console.log('🔍 Exécution des tests de diagnostic...\n');
  
  for (const test of tests) {
    await runTest(test);
  }
  
  console.log('🏁 Tests terminés');
  console.log('\n💡 Conseils:');
  console.log('   - Si les tests échouent, vérifiez votre configuration Firebase');
  console.log('   - Utilisez le panneau de débogage (🐛) dans l\'application');
  console.log('   - Consultez docs/TROUBLESHOOTING.md pour plus d\'aide');
}

// Exécuter les tests
if (require.main === module) {
  runAllTests().catch(console.error);
}

module.exports = { runAllTests, runTest };
