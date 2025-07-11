import React, { createContext, useState, useContext, ReactNode, useEffect } from 'react';

export type User = {
  user_id: string; // or number, depending on your actual user_id type
  id: string; // UUID de Auth
  profileId: string; // ID interno de profiles (PK)
  name: string;
  email: string;
  experience_years?: number;
  lng?: number | string;
  lat?: number | string;
  phone?: string;
  address?: string;
  bio?: string;
  avatar_url?: string;
  header_image_url?: string; // <-- Añadido para imagen de cabecera
  materials?: string[];
  online?: boolean;
  type?: string;
  role?: string;
  // ...otros campos
};

interface UserContextType {
  user: User | null;
  login: (userData: User) => void;
  logout: () => void;
  isAuthenticated: boolean;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

export const UserProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(() => {
    // Restaurar usuario desde localStorage si existe
    try {
      const stored = localStorage.getItem('eco_user');
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });

  // Persistir usuario en localStorage
  useEffect(() => {
    if (user) {
      localStorage.setItem('eco_user', JSON.stringify(user));
    } else {
      localStorage.removeItem('eco_user');
    }
  }, [user]);

  // Escuchar cambios de sesión de Supabase (si está disponible)
  useEffect(() => {
    let sub: any;
    try {
      import('../lib/supabase').then(({ supabase }) => {
        sub = supabase.auth.onAuthStateChange((_, session) => {
          if (!session) {
            setUser(null);
            console.log('[UserContext] Sesión de Supabase terminada, usuario deslogueado');
          }
        });
      });
    } catch {}
    return () => {
      if (sub && typeof sub.unsubscribe === 'function') sub.unsubscribe();
    };
  }, []);

  const login = (userData: User) => setUser(userData);
  const logout = () => setUser(null);

  return (
    <UserContext.Provider value={{ user, login, logout, isAuthenticated: !!user }}>
      {children}
    </UserContext.Provider>
  );
};

// eslint-disable-next-line react-refresh/only-export-components
export const useUser = (): UserContextType => {
  const context = useContext(UserContext);
  if (context === undefined) {
    throw new Error('useUser must be used within a UserProvider');
  }
  return context;
};

// fetchRecyclers has been moved to a separate file for Fast Refresh compatibility.