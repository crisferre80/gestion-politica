import React, { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Menu, X, Recycle, LogOut, User, Settings, Key } from 'lucide-react';
import { useUser } from '../context/UserContext';
import { getAvatarUrl } from '../utils/feedbackHelper';

const Navbar: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [showAccountMenu, setShowAccountMenu] = useState(false);
  const { user, logout, isAuthenticated } = useUser();
  const accountMenuRef = useRef<HTMLDivElement>(null);

  const toggleMenu = () => {
    setIsOpen(!isOpen);
  };

  const handleLogout = async () => {
    if (user?.id) {
      await import('../lib/supabase').then(({ supabase }) =>
        supabase.from('profiles').update({ online: false }).eq('user_id', user.id)
      );
    }
    await logout();
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (accountMenuRef.current && !accountMenuRef.current.contains(event.target as Node)) {
        setShowAccountMenu(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  return (
    <nav className="bg-green-600 text-white shadow-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-14 md:h-16 items-center">
          <div className="flex items-center">
            <Link to="/" className="flex items-center">
              <Recycle className="h-7 w-7 md:h-8 md:w-8 mr-2" />
              <span className="font-bold text-lg md:text-xl">Asura EcoNecta2</span>
            </Link>
          </div>

          {/* Desktop menu */}
          <div className="hidden md:flex items-center space-x-4">
            <Link to="/" className="px-3 py-2 rounded-md hover:bg-green-700">Inicio</Link>
            {isAuthenticated ? (
              <>
                <Link to="/dashboard" className="px-3 py-2 rounded-md hover:bg-green-700">Mi Panel</Link>
                {/* Acceso Admin solo para el usuario admin */}
                {user?.email === 'cristianferreyra8076@gmail.com' && (
                  <Link to="/admin-panel" className="px-3 py-2 rounded-md bg-yellow-400 text-green-900 font-bold hover:bg-yellow-500 transition">Acceso Administrador</Link>
                )}
                <div className="relative" ref={accountMenuRef}>
                  <button 
                    onClick={() => setShowAccountMenu(!showAccountMenu)}
                    className="flex items-center px-3 py-2 rounded-md hover:bg-green-700"
                  >
                    <img 
                      src={getAvatarUrl(user?.avatar_url, user?.name)} 
                      alt={user?.name || 'Usuario'} 
                      className="h-8 w-8 rounded-full mr-2"
                    />
                    <span className="truncate max-w-[100px]">{user?.name || 'Mi Cuenta'}</span>
                  </button>
                  {showAccountMenu && (
                    <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg py-1 z-50 text-gray-900">
                      <div className="px-4 py-2 border-b border-gray-200">
                        <p className="text-sm font-medium">{user?.name}</p>
                        <p className="text-xs text-gray-500">{user?.email}</p>
                      </div>
                      {user?.id && (
                        <Link to={`/recycler-profile/${user.id}`} className="block px-4 py-2 text-sm hover:bg-gray-100 flex items-center">
                          <User className="h-4 w-4 mr-2" />Mi Perfil
                        </Link>
                      )}
                      <Link to="/profile" className="block px-4 py-2 text-sm hover:bg-gray-100 flex items-center"><Settings className="h-4 w-4 mr-2" />Configuración</Link>
                      <Link to="/change-password" className="block px-4 py-2 text-sm hover:bg-gray-100 flex items-center"><Key className="h-4 w-4 mr-2" />Cambiar contraseña</Link>
                      <button onClick={handleLogout} className="block w-full text-left px-4 py-2 text-sm hover:bg-gray-100 flex items-center"><LogOut className="h-4 w-4 mr-2" />Cerrar sesión</button>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <>
                <Link to="/login" className="px-3 py-2 rounded-md hover:bg-green-700">Ingresar</Link>
                <Link to="/register" className="px-3 py-2 bg-white text-green-600 font-medium rounded-md hover:bg-gray-100">Registrarse</Link>
              </>
            )}
          </div>

          {/* Mobile menu button */}
          <div className="md:hidden flex items-center">
            <button
              onClick={toggleMenu}
              className="inline-flex items-center justify-center p-2 rounded-md hover:bg-green-700 focus:outline-none"
            >
              {isOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile menu */}
      {isOpen && (
        <div className="md:hidden bg-green-700/95 backdrop-blur-sm">
          <div className="px-2 pt-2 pb-3 space-y-1 sm:px-3">
            <Link to="/" className="block px-3 py-2 rounded-md hover:bg-green-800">Inicio</Link>
            {isAuthenticated ? (
              <>
                <Link to="/dashboard" className="block px-3 py-2 rounded-md hover:bg-green-800">Mi Panel</Link>
                <button
                  onClick={async (e) => { e.stopPropagation(); await handleLogout(); setShowAccountMenu(false); setIsOpen(false); }}
                  className="block w-full text-left px-3 py-2 rounded-md hover:bg-green-800 flex items-center text-red-100 font-semibold"
                >
                  <LogOut className="h-5 w-5 mr-2" />Cerrar sesión
                </button>
                {/* Avatar como botón para desplegar menú */}
                <button
                  onClick={() => setShowAccountMenu(!showAccountMenu)}
                  className="w-10 h-10 rounded-full overflow-hidden border-2 border-green-300 flex items-center justify-center mx-2 my-2 focus:outline-none focus:ring-2 focus:ring-green-400"
                  aria-label="Opciones de cuenta"
                >
                  <img src={getAvatarUrl(user?.avatar_url, user?.name)} alt={user?.name || 'Usuario'} className="w-full h-full object-cover" />
                </button>
                {showAccountMenu && (
                  <div className="bg-white rounded-md shadow-lg py-1 z-50 text-gray-900 mt-2 absolute left-4 right-4 mx-auto max-w-xs">
                    <div className="px-4 py-2 border-b border-gray-200 text-center">
                      <img src={getAvatarUrl(user?.avatar_url, user?.name)} alt={user?.name || 'Usuario'} className="w-14 h-14 rounded-full mx-auto mb-2 object-cover border-2 border-green-400" />
                      <p className="text-sm font-medium">{user?.name}</p>
                      <p className="text-xs text-gray-500">{user?.email}</p>
                    </div>
                    {user?.id && (
                      <Link to={`/recycler-profile/${user.id}`} className="block px-4 py-2 text-sm hover:bg-gray-100 flex items-center">
                        <User className="h-4 w-4 mr-2" />Mi Perfil
                      </Link>
                    )}
                    <Link to="/profile" className="block px-4 py-2 text-sm hover:bg-gray-100 flex items-center"><Settings className="h-4 w-4 mr-2" />Configuración</Link>
                    <Link to="/change-password" className="block px-4 py-2 text-sm hover:bg-gray-100 flex items-center"><Key className="h-4 w-4 mr-2" />Cambiar contraseña</Link>
                  </div>
                )}
              </>
            ) : (
              <>
                <Link to="/login" className="block px-3 py-2 rounded-md hover:bg-green-800">Ingresar</Link>
                <Link to="/register" className="block px-3 py-2 bg-white text-green-600 font-medium rounded-md hover:bg-gray-100">Registrarse</Link>
              </>
            )}
          </div>
        </div>
      )}
    </nav>
  );
};

export default Navbar;