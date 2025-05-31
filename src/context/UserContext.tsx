import React, { createContext, useState, useContext, ReactNode } from 'react';

export type User = {
  id: string;
  name: string;
  email: string;
  experience_years?: number;
  lng?: number | string;
  lat?: number | string;
  phone?: string;
  address?: string;
  bio?: string;
  avatar_url?: string;
  materials?: string[];
  online?: boolean;
  type?: string;
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
  const [user, setUser] = useState<User | null>(null);

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