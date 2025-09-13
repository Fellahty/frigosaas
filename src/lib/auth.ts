import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from './firebase';

export interface UserCredentials {
  id: string;
  name: string;
  phone: string;
  username: string;
  password: string;
  role: 'admin' | 'manager' | 'viewer';
  isActive: boolean;
  tenantId: string;
}

export const authenticateUser = async (
  loginField: string, 
  password: string, 
  tenantId: string
): Promise<UserCredentials | null> => {
  try {
    console.log('🔍 Authenticating user:', { loginField, password: '***', tenantId });
    
    // First, let's check all users in this tenant to debug
    let debugQuery = query(
      collection(db, 'users'),
      where('tenantId', '==', tenantId)
    );
    let debugSnapshot = await getDocs(debugQuery);
    console.log('🔍 All users in tenant:', debugSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })));
    
    // First try to find by username (without isActive filter first)
    let q = query(
      collection(db, 'users'),
      where('username', '==', loginField),
      where('tenantId', '==', tenantId)
    );
    
    let querySnapshot = await getDocs(q);
    console.log('📋 Username query results:', querySnapshot.docs.length);
    
    // If not found by username, try by phone
    if (querySnapshot.empty) {
      q = query(
        collection(db, 'users'),
        where('phone', '==', loginField),
        where('tenantId', '==', tenantId)
      );
      
      querySnapshot = await getDocs(q);
      console.log('📱 Phone query results:', querySnapshot.docs.length);
    }
    
    if (querySnapshot.empty) {
      console.log('❌ No user found');
      return null;
    }
    
    const userDoc = querySnapshot.docs[0];
    const userData = userDoc.data() as any;
    console.log('👤 User found:', { 
      id: userDoc.id, 
      username: userData.username, 
      phone: userData.phone, 
      isActive: userData.isActive,
      tenantId: userData.tenantId,
      passwordMatch: userData.password === password 
    });
    
    // Check if user is active (if isActive field exists)
    if (userData.isActive === false) {
      console.log('❌ User is inactive');
      return null;
    }
    
    // In production, you would hash the password and compare hashes
    if (userData.password === password) {
      console.log('✅ Password match!');
      return {
        ...userData,
        id: userDoc.id
      };
    }
    
    console.log('❌ Password mismatch');
    return null;
  } catch (error) {
    console.error('❌ Authentication error:', error);
    return null;
  }
};

export const getUserByUsername = async (
  username: string, 
  tenantId: string
): Promise<UserCredentials | null> => {
  try {
    const q = query(
      collection(db, 'users'),
      where('username', '==', username),
      where('tenantId', '==', tenantId)
    );
    
    const querySnapshot = await getDocs(q);
    
    if (querySnapshot.empty) {
      return null;
    }
    
    const userDoc = querySnapshot.docs[0];
    const userData = userDoc.data() as UserCredentials;
    
    return {
      ...userData,
      id: userDoc.id
    };
  } catch (error) {
    console.error('Error fetching user:', error);
    return null;
  }
};
