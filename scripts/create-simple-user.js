import { initializeApp } from 'firebase/app';
import { getFirestore, collection, addDoc, Timestamp } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "demo-key",
  authDomain: "demo-project.firebaseapp.com",
  projectId: "demo-project",
  storageBucket: "demo-project.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:demo"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function createSimpleUser() {
  try {
    console.log('Creating simple test user...');
    
    // Create Firestore user document directly
    const userDoc = await addDoc(collection(db, 'users'), {
      tenantId: 'YAZAMI',
      name: 'Test User',
      email: 'test@gmail.com',
      username: 'testuser',
      password: 'password123',
      role: 'admin',
      isActive: true,
      createdAt: Timestamp.fromDate(new Date()),
    });
    
    console.log('✅ Test user created successfully!');
    console.log('Username: testuser');
    console.log('Password: password123');
    console.log('Email: test@gmail.com');
    console.log('Role: admin');
    
  } catch (error) {
    console.error('❌ Error creating test user:', error);
  }
}

createSimpleUser();
