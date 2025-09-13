import { useState, useEffect } from 'react';
import { useAuth } from './useAuth';

export interface UserContext {
  id: string;
  name: string;
  email: string;
  role: string;
}

export const useUserContext = () => {
  const { user } = useAuth();
  const [userContext, setUserContext] = useState<UserContext | null>(null);

  useEffect(() => {
    if (user) {
      const context: UserContext = {
        id: user.uid,
        name: user.displayName || user.email?.split('@')[0] || 'Admin',
        email: user.email || '',
        role: 'admin', // For now, default to admin. In a real app, this would come from user profile
      };
      
      setUserContext(context);
      // Store in localStorage for logging
      localStorage.setItem('currentUser', JSON.stringify(context));
    } else {
      setUserContext(null);
      localStorage.removeItem('currentUser');
    }
  }, [user]);

  return { userContext, isAuthenticated: !!user };
};
