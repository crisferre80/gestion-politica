import React from 'react';
import { Link } from 'react-router-dom';
import { useUser } from '../context/UserContext';
import DashboardRecycler from './DashboardRecycler';
import DashboardResident from './DashboardResident';
import AdminPanel from './AdminPanel';

const Dashboard: React.FC = () => {
  const { user } = useUser();
  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-xl text-gray-600 mb-4">Debes iniciar sesión para ver esta página</p>
          <Link to="/login" className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700">
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
  // Cualquier otro tipo (antes existía 'resident_institutional') se muestra como Referente (DashboardResident)
  return <DashboardResident />;
};

export default Dashboard;