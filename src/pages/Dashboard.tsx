import React from 'react';
import { Link } from 'react-router-dom';
import { useUser } from '../context/UserContext';
import DashboardReferente from './DashboardReferente';
import DashboardDirigente from './DashboardDirigente';
import DashboardFiscal from './DashboardFiscal';
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
  // Usuarios con rol 'fiscal' ven el dashboard institucional
  if (user.role === 'fiscal') {
    return <DashboardFiscal />;
  }
  // Mostrar panel de Referente si el usuario tiene rol 'referente' o type 'recycler'
  if (user.role === 'referente' || user.type === 'recycler') {
    return <DashboardReferente />;
  }

  // Mostrar panel de Dirigente si explícitamente es un dirigente
  if (user.role === 'dirigente' || user.type === 'dirigente') {
    return <DashboardDirigente />;
  }

  // Fallback: mostrar el panel del Referente por defecto para usuarios no administrativos
  return <DashboardReferente />;
};

export default Dashboard;