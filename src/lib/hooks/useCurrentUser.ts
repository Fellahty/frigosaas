import { useState, useEffect } from 'react';
import { useAuth } from './useAuth';

export interface CurrentUser {
  id: string;
  name: string;
  email: string;
  role?: string;
}

export const useCurrentUser = () => {
  const { user } = useAuth();
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);

  useEffect(() => {
    if (user) {
      setCurrentUser({
        id: user.uid,
        name: user.displayName || user.email?.split('@')[0] || 'Utilisateur',
        email: user.email || '',
        role: 'admin', // For now, default to admin. In a real app, this would come from user profile
      });
    } else {
      setCurrentUser(null);
    }
  }, [user]);

  return { currentUser, isAuthenticated: !!user };
};
