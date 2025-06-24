import React from 'react';
import { Link } from 'react-router-dom';
import { useUser } from '../context/UserContext';
import DashboardRecycler from './DashboardRecycler';
import DashboardResident from './DashboardResident';
import AdminPanel from './AdminPanel';
import DashboardInstitutional from './DashboardInstitutional';

const Dashboard: React.FC = () => {
  const { user } = useUser();
  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-xl text-gray-600 mb-4">Debes iniciar sesión para ver esta página</p>
          <Link to="/login" className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700">
            Iniciar sesión
          </Link>
        </div>
      </div>
    );
  }
  if (user.role === 'admin') {
    return <AdminPanel />;
  }
  if (user.type === 'recycler') {
    return <DashboardRecycler />;
  }
  if (user.type === 'resident_institutional') {
    return <DashboardInstitutional />;
  }
  return <DashboardResident />;
};

export default Dashboard;