import { useState, useEffect } from 'react';

interface CustomUser {
  id: string;
  name: string;
  phone: string;
  username?: string;
  email?: string;
  role: string;
  tenantId: string;
  userType?: 'manager' | 'client';
}

export const useAuth = () => {
  const [user, setUser] = useState<CustomUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    console.log('useAuth: Checking for stored user...');
    // Check if user is stored in localStorage
    const storedUser = localStorage.getItem('user');
    console.log('useAuth: storedUser exists:', !!storedUser);
    
    if (storedUser) {
      try {
        const parsedUser = JSON.parse(storedUser);
        console.log('useAuth: parsed user:', parsedUser);
        setUser(parsedUser);
      } catch (error) {
        console.error('useAuth: Error parsing stored user:', error);
        localStorage.removeItem('user');
      }
    } else {
      console.log('useAuth: No stored user found');
    }
    setLoading(false);
    console.log('useAuth: Loading set to false');
  }, []);

  const login = async (username: string, password: string) => {
    try {
      // This will be handled by the LoginPage component
      return { success: false, error: 'Use authenticateUser from auth.ts' };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  };

  const logout = async () => {
    try {
      localStorage.removeItem('user');
      setUser(null);
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  };

  return {
    user,
    setUser,
    loading,
    login,
    logout,
  };
};
