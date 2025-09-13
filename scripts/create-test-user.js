import { initializeApp } from 'firebase/app';
import { getFirestore, collection, addDoc, Timestamp } from 'firebase/firestore';
import { getAuth, createUserWithEmailAndPassword } from 'firebase/auth';

const firebaseConfig = {
  apiKey: "AIzaSyBvOkBwJ1Z4Z4Z4Z4Z4Z4Z4Z4Z4Z4Z4Z4Z4",
  authDomain: "frigosaas.firebaseapp.com",
  projectId: "frigosaas",
  storageBucket: "frigosaas.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abcdef123456789"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

async function createTestUser() {
  try {
    console.log('Creating test user...');
    
    // Create Firebase Auth user
    const userCredential = await createUserWithEmailAndPassword(auth, 'test@gmail.com', 'password123');
    const firebaseUser = userCredential.user;
    console.log('Firebase Auth user created:', firebaseUser.uid);
    
    // Create Firestore user document
    const userDoc = await addDoc(collection(db, 'users'), {
      tenantId: 'YAZAMI',
      name: 'Test User',
      email: 'test@gmail.com',
      username: 'testuser',
      password: 'password123',
      role: 'admin',
      isActive: true,
      firebaseUid: firebaseUser.uid,
      createdAt: Timestamp.fromDate(new Date()),
    });
    
    console.log('Firestore user created:', userDoc.id);
    console.log('✅ Test user created successfully!');
    console.log('Email: test@gmail.com');
    console.log('Password: password123');
    
  } catch (error) {
    console.error('❌ Error creating test user:', error);
  }
}

createTestUser();
