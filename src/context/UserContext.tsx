import React, { createContext, useState, useContext, ReactNode } from 'react';
import { supabase } from '../lib/supabase';


 


export interface User {
  id: string;
  name: string;
  email: string;
  phone?: string;
  address?: string;
  type: 'resident' | 'recycler';
  avatar_url?: string;
  online?: boolean;
  // Agrega estos campos:
  lat?: number;
  lng?: number;
  // ...otros campos...
}

interface UserContextType {
  user: User | null;
  login: (userData: User) => void;
  logout: () => void;
  isAuthenticated: boolean;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

export const UserProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);

  const login = (userData: User) => {
    setUser(userData);
  };

  const logout = () => {
    setUser(null);
  };

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

// Ejemplo de función para obtener recicladores desde Supabase
// eslint-disable-next-line react-refresh/only-export-components
export async function fetchRecyclers() {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, name, email, phone, avatar_url, online, rating_average, total_ratings, materials, type')
    .eq('type', 'recycler');

  if (error) throw error;
  return data;
}