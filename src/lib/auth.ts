import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from './firebase';

export interface UserCredentials {
  id: string;
  name: string;
  phone: string;
  username?: string;
  email?: string;
  password: string;
  role: 'admin' | 'manager' | 'viewer' | 'client';
  isActive: boolean;
  tenantId: string;
}

export const authenticateUser = async (
  loginField: string, 
  password: string, 
  tenantId: string,
  userType: 'manager' | 'client' = 'manager'
): Promise<UserCredentials | null> => {
  try {
    console.log('🔍 Authenticating user:', { loginField, password: '***', tenantId, userType });
    
    let querySnapshot = null;
    let userData = null;
    let userDoc = null;
    
    if (userType === 'manager') {
      // For managers, check in the 'users' collection
      console.log('👨‍💼 Checking managers in users collection...');
      
      // Try to find by email first
      let q = query(
        collection(db, 'users'),
        where('email', '==', loginField),
        where('tenantId', '==', tenantId)
      );
      querySnapshot = await getDocs(q);
      console.log('📧 Email query results for managers:', querySnapshot.docs.length);
      
      // If not found by email, try by phone
      if (querySnapshot.empty) {
        q = query(
          collection(db, 'users'),
          where('phone', '==', loginField),
          where('tenantId', '==', tenantId)
        );
        querySnapshot = await getDocs(q);
        console.log('📱 Phone query results for managers:', querySnapshot.docs.length);
      }
      
      if (!querySnapshot.empty) {
        userDoc = querySnapshot.docs[0];
        userData = userDoc.data() as any;
      }
      
    } else {
      // For clients, check in the 'tenants/YAZAMI/clients' collection
      console.log('👥 Checking clients in tenants/YAZAMI/clients collection...');
      
      // Try to find by email first
      let q = query(
        collection(db, 'tenants', tenantId, 'clients'),
        where('email', '==', loginField)
      );
      querySnapshot = await getDocs(q);
      console.log('📧 Email query results for clients:', querySnapshot.docs.length);
      
      // If not found by email, try by phone
      if (querySnapshot.empty) {
        q = query(
          collection(db, 'tenants', tenantId, 'clients'),
          where('phone', '==', loginField)
        );
        querySnapshot = await getDocs(q);
        console.log('📱 Phone query results for clients:', querySnapshot.docs.length);
      }
      
      if (!querySnapshot.empty) {
        userDoc = querySnapshot.docs[0];
        userData = userDoc.data() as any;
      }
    }
    
    if (querySnapshot.empty || !userData) {
      console.log('❌ No user found');
      return null;
    }
    
    console.log('👤 User found:', { 
      id: userDoc.id, 
      username: userData.username, 
      email: userData.email,
      phone: userData.phone,
      isActive: userData.isActive,
      tenantId: userType === 'client' ? tenantId : userData.tenantId,
      userType,
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
        id: userDoc.id,
        tenantId: userType === 'client' ? tenantId : userData.tenantId,
        role: userType === 'client' ? 'client' : userData.role
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
