import React, { createContext, useState, useContext, ReactNode } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

// eslint-disable-next-line react-refresh/only-export-components
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

type UserType = 'recycler' | 'resident' | null;

interface User {
  online: boolean;
  total_ratings: undefined;
  rating_average: number;
  avatar_url: never;
  id: string;
  name: string;
  email: string;
  type: UserType;
  phone?: string;
  address?: string;
  materials?: string[];
  schedule?: string;
  bio?: string;
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