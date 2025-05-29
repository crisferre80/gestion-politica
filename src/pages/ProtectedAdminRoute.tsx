import React from 'react';
import { Navigate } from 'react-router-dom';
import { useUser } from '../context/UserContext';

const ADMIN_EMAIL = 'cristianferreyra8076@gmail.com';

const ProtectedAdminRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useUser();
  if (!user || user.email !== ADMIN_EMAIL) {
    return <Navigate to="/" replace />;
  }
  return <>{children}</>;
};

export default ProtectedAdminRoute;
