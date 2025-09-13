# Guide de Résolution des Problèmes

## 🐛 Problèmes de Chargement des Données

### 1. Page blanche ou données ne se chargent pas

#### **Causes possibles :**
- Configuration Firebase incorrecte
- Règles de sécurité Firestore trop restrictives
- Problème de réseau
- Paramètres non initialisés

#### **Solutions :**

##### **Étape 1 : Vérifier la configuration Firebase**
```bash
# Tester la connexion Firestore
node scripts/test-firestore.js
```

##### **Étape 2 : Initialiser les paramètres**
```bash
# Initialiser les paramètres pour votre tenant
node scripts/init-settings.js init YAZAMI
```

##### **Étape 3 : Vérifier les règles Firestore**
```javascript
// Dans Firebase Console > Firestore > Rules
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Règle pour les paramètres
    match /tenants/{tenantId}/settings/app {
      allow read, write: if request.auth != null;
    }
    
    // Règle pour les réservations
    match /tenants/{tenantId}/reservations/{document} {
      allow read, write: if request.auth != null;
    }
    
    // Règle pour les clients
    match /tenants/{tenantId}/clients/{document} {
      allow read, write: if request.auth != null;
    }
  }
}
```

##### **Étape 4 : Utiliser le panneau de débogage**
1. Ouvrir la page des réservations
2. Cliquer sur le bouton 🐛 en bas à droite
3. Vérifier les informations de débogage

### 2. Erreurs d'import/export

#### **Erreur : "does not provide an export named 'X'"**

**Solution :**
```typescript
// ❌ Incorrect
import { logCreate } from '../../lib/firebase';

// ✅ Correct
import { logCreate } from '../../lib/logging';
```

#### **Erreur : "does not provide an export named 'AppSettingsPage'"**

**Solution :**
```typescript
// Dans AppSettingsPage.tsx
export { AppSettingsPage };
export default AppSettingsPage;

// Dans router.tsx
import { AppSettingsPage } from '../features/settings/AppSettingsPage';
```

### 3. Problèmes de cache

#### **Vider le cache du navigateur :**
1. **Chrome/Edge :** Ctrl+Shift+R (Windows) ou Cmd+Shift+R (Mac)
2. **Firefox :** Ctrl+F5 (Windows) ou Cmd+Shift+R (Mac)
3. **Safari :** Cmd+Option+R (Mac)

#### **Vider le cache Vite :**
```bash
# Supprimer le cache Vite
rm -rf node_modules/.vite
rm -rf dist

# Réinstaller et redémarrer
npm install
npm run dev
```

### 4. Problèmes de réseau

#### **Vérifier la connexion :**
```bash
# Tester la connectivité
ping google.com
ping firebase.google.com
```

#### **Vérifier les variables d'environnement :**
```bash
# Vérifier que les variables sont définies
echo $VITE_FIREBASE_PROJECT_ID
echo $VITE_FIREBASE_API_KEY
```

### 5. Problèmes de données

#### **Vérifier les données dans Firestore :**
1. Ouvrir Firebase Console
2. Aller dans Firestore Database
3. Vérifier le chemin : `/tenants/YAZAMI/settings/app`
4. Vérifier que les données existent

#### **Créer des données de test :**
```bash
# Initialiser les paramètres
node scripts/init-settings.js init YAZAMI

# Lister les paramètres existants
node scripts/init-settings.js list YAZAMI
```

## 🔧 Outils de Débogage

### 1. Panneau de débogage
- **Accès :** Bouton 🐛 en bas à droite de la page
- **Informations :** Tenant ID, état du chargement, paramètres actuels
- **Actions :** Recharger les données, logs console

### 2. Console du navigateur
```javascript
// Vérifier les paramètres
console.log('Settings:', window.appSettings);

// Vérifier le tenant ID
console.log('Tenant ID:', window.tenantId);

// Vérifier les erreurs
console.error('Erreurs:', window.errors);
```

### 3. Logs de développement
```bash
# Activer les logs détaillés
DEBUG=* npm run dev

# Ou avec Vite
VITE_DEBUG=true npm run dev
```

## 📊 Monitoring

### 1. Métriques de performance
- **Temps de chargement** des paramètres
- **Nombre de requêtes** Firestore
- **Taux d'erreur** des requêtes

### 2. Alertes
- **Erreurs de connexion** Firestore
- **Paramètres manquants**
- **Échecs de chargement**

### 3. Logs
- **Tous les chargements** de paramètres
- **Erreurs** avec détails
- **Actions utilisateur** importantes

## 🚀 Optimisations

### 1. Cache intelligent
```typescript
// Configuration optimale
staleTime: 2 * 60 * 1000, // 2 minutes
cacheTime: 5 * 60 * 1000, // 5 minutes
retry: 3,
retryDelay: 1000,
```

### 2. Chargement progressif
```typescript
// Charger les paramètres critiques en premier
const { settings } = useAppSettings();
const { data: clients } = useQuery({
  queryKey: ['clients', tenantId],
  queryFn: fetchClients,
  enabled: !!settings, // Attendre les paramètres
});
```

### 3. Fallback gracieux
```typescript
// Toujours fournir des valeurs par défaut
const settings = useAppSettings();
const effectiveSettings = settings.settings || defaultSettings;
```

## 📞 Support

### 1. Informations à fournir
- **Version** de l'application
- **Navigateur** et version
- **Console** du navigateur (erreurs)
- **Logs** de débogage
- **Configuration** Firebase

### 2. Étapes de diagnostic
1. **Vérifier** la configuration Firebase
2. **Tester** la connexion Firestore
3. **Initialiser** les paramètres
4. **Vérifier** les règles de sécurité
5. **Utiliser** le panneau de débogage

### 3. Solutions rapides
- **Recharger** la page (Ctrl+F5)
- **Vider** le cache du navigateur
- **Redémarrer** le serveur de développement
- **Vérifier** la connexion internet
