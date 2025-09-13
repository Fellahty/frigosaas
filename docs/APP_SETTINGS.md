# Système de Paramètres de l'Application

## 📋 Vue d'ensemble

Le système de paramètres permet de gérer des configurations globales accessibles sur toutes les plateformes (Web, Mobile, API). Ces paramètres sont stockés dans Firestore et mis en cache localement pour des performances optimales.

## 🏗️ Architecture

### Structure des données
```
/tenants/{tenantId}/settings/app
├── defaultEntryDate: "2024-01-15"
├── defaultExitDate: "2024-02-15"
├── dateFormat: "DD/MM/YYYY"
├── companyName: "Frigo SaaS"
├── currency: "MAD"
├── currencySymbol: "د.م"
├── emailNotifications: true
├── smsNotifications: false
├── theme: "light"
├── language: "fr"
├── maxReservationDays: 365
├── minDepositPercentage: 10
├── autoApproveReservations: false
├── maxFileSize: 10
└── allowedFileTypes: ["jpg", "jpeg", "png", "gif", "pdf"]
```

### Hooks disponibles

#### `useAppSettings()`
Hook principal pour accéder à tous les paramètres.

```typescript
import { useAppSettings } from '../lib/hooks/useAppSettings';

const MyComponent = () => {
  const { settings, isLoading, error, isDefault } = useAppSettings();
  
  if (isLoading) return <div>Chargement...</div>;
  if (error) return <div>Erreur: {error.message}</div>;
  
  return (
    <div>
      <h1>{settings.companyName}</h1>
      <p>Devise: {settings.currency} {settings.currencySymbol}</p>
    </div>
  );
};
```

#### `useDateSettings()`
Hook spécialisé pour les paramètres de dates.

```typescript
import { useDateSettings } from '../lib/hooks/useAppSettings';

const MyComponent = () => {
  const { formatDate, getDefaultEntryDate, getDefaultExitDate, dateFormat } = useDateSettings();
  
  const entryDate = getDefaultEntryDate();
  const formattedDate = formatDate(entryDate);
  
  return <div>Date d'entrée: {formattedDate}</div>;
};
```

#### `useBusinessSettings()`
Hook spécialisé pour les paramètres métier.

```typescript
import { useBusinessSettings } from '../lib/hooks/useAppSettings';

const MyComponent = () => {
  const { companyName, currency, maxReservationDays } = useBusinessSettings();
  
  return (
    <div>
      <h1>{companyName}</h1>
      <p>Durée max: {maxReservationDays} jours</p>
    </div>
  );
};
```

## 🚀 Utilisation

### 1. Initialisation des paramètres

```bash
# Initialiser les paramètres pour un tenant
node scripts/init-app-settings.js YAZAMI
```

### 2. Accès aux paramètres dans les composants

```typescript
// Dans n'importe quel composant
const { settings } = useAppSettings();

// Utiliser les paramètres
const defaultEntryDate = settings.defaultEntryDate;
const companyName = settings.companyName;
```

### 3. Mise à jour des paramètres

```typescript
// Dans AppSettingsPage.tsx
const updateSettings = useMutation({
  mutationFn: async (newSettings: AppSettings) => {
    const docRef = doc(db, 'tenants', tenantId, 'settings', 'app');
    await setDoc(docRef, newSettings, { merge: true });
    return newSettings;
  },
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['app-settings', tenantId] });
  },
});
```

## 🔧 Configuration

### Paramètres de dates
- **defaultEntryDate**: Date d'entrée par défaut pour les réservations
- **defaultExitDate**: Date de sortie par défaut pour les réservations
- **dateFormat**: Format d'affichage des dates (DD/MM/YYYY, MM/DD/YYYY, YYYY-MM-DD)

### Paramètres métier
- **companyName**: Nom de l'entreprise
- **currency**: Code de la devise (MAD, EUR, USD)
- **currencySymbol**: Symbole de la devise (د.م, €, $)
- **maxReservationDays**: Durée maximale de réservation en jours
- **minDepositPercentage**: Pourcentage minimum de dépôt
- **autoApproveReservations**: Approuver automatiquement les réservations

### Paramètres de notifications
- **emailNotifications**: Activer les notifications par email
- **smsNotifications**: Activer les notifications par SMS

### Paramètres d'interface
- **theme**: Thème de l'application (light, dark, auto)
- **language**: Langue par défaut (fr, ar, en)

### Paramètres de stockage
- **maxFileSize**: Taille maximale des fichiers en MB
- **allowedFileTypes**: Types de fichiers autorisés

## 📱 Accessibilité multi-plateforme

### Web (React)
```typescript
import { useAppSettings } from './hooks/useAppSettings';
const { settings } = useAppSettings();
```

### Mobile (React Native)
```typescript
// Même hook, même API
import { useAppSettings } from './hooks/useAppSettings';
const { settings } = useAppSettings();
```

### API (Node.js)
```typescript
// Utiliser le script d'initialisation
const { initAppSettings, updateAppSettings } = require('./scripts/init-app-settings');
await initAppSettings('YAZAMI');
```

## 🔄 Cache et Performance

- **Cache local**: 5 minutes (staleTime)
- **Cache global**: 10 minutes (cacheTime)
- **Invalidation**: Automatique lors des mises à jour
- **Fallback**: Paramètres par défaut si pas de configuration

## 🛠️ Maintenance

### Ajouter un nouveau paramètre

1. **Mettre à jour l'interface** dans `useAppSettings.ts`:
```typescript
export interface AppSettings {
  // ... paramètres existants
  newParameter: string;
}
```

2. **Ajouter la valeur par défaut**:
```typescript
const defaultSettings: AppSettings = {
  // ... paramètres existants
  newParameter: 'default-value',
};
```

3. **Mettre à jour l'interface** dans `AppSettingsPage.tsx`:
```typescript
<input
  type="text"
  value={formData.newParameter}
  onChange={(e) => setFormData(prev => ({ ...prev, newParameter: e.target.value }))}
  disabled={!isEditing}
  className="w-full border rounded-md px-3 py-2 disabled:bg-gray-100"
/>
```

### Migration des paramètres existants

```typescript
// Script de migration
const migrateSettings = async (tenantId) => {
  const docRef = doc(db, 'tenants', tenantId, 'settings', 'app');
  const docSnap = await getDoc(docRef);
  
  if (docSnap.exists()) {
    const currentSettings = docSnap.data();
    const migratedSettings = {
      ...currentSettings,
      newParameter: currentSettings.oldParameter || 'default-value'
    };
    
    await setDoc(docRef, migratedSettings);
  }
};
```

## 🚨 Bonnes pratiques

1. **Toujours fournir des valeurs par défaut**
2. **Utiliser TypeScript** pour la sécurité des types
3. **Valider les paramètres** côté serveur
4. **Mettre en cache** pour les performances
5. **Documenter** les nouveaux paramètres
6. **Tester** sur toutes les plateformes
7. **Migrer** les paramètres existants lors des mises à jour

## 📊 Monitoring

- **Logs**: Toutes les modifications sont loggées
- **Audit**: Historique des changements dans Firestore
- **Métriques**: Utilisation des paramètres via Analytics
- **Alertes**: Notifications en cas d'erreur de configuration
