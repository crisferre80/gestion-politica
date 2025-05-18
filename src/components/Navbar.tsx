import React, { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Menu, X, Recycle, LogOut, User, Settings, Key } from 'lucide-react';
import { useUser } from '../context/UserContext';
import { supabase } from '../lib/supabase';

const Navbar: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [showAccountMenu, setShowAccountMenu] = useState(false);
  const { user, logout, isAuthenticated } = useUser();
  const accountMenuRef = useRef<HTMLDivElement>(null);

  const toggleMenu = () => {
    setIsOpen(!isOpen);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    logout();
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
        <div className="flex justify-between h-16">
          <div className="flex items-center">
            <Link to="/" className="flex items-center">
              <Recycle className="h-8 w-8 mr-2" />
              <span className="font-bold text-xl">Asura EcoConecta</span>
            </Link>
          </div>

          {/* Desktop menu */}
          <div className="hidden md:flex items-center space-x-4">
            <Link to="/" className="px-3 py-2 rounded-md hover:bg-green-700">Inicio</Link>
            <Link to="/collection-points" className="px-3 py-2 rounded-md hover:bg-green-700">Puntos de Recolección</Link>
            
            {isAuthenticated ? (
              <>
                <Link to="/dashboard" className="px-3 py-2 rounded-md hover:bg-green-700">
                  Mi Panel
                </Link>
                <div className="relative" ref={accountMenuRef}>
                  <button 
                    onClick={() => setShowAccountMenu(!showAccountMenu)}
                    className="flex items-center px-3 py-2 rounded-md hover:bg-green-700"
                  >
                    {user?.avatar_url ? (
                      <img 
                        src={user.avatar_url} 
                        alt={user.name} 
                        className="h-8 w-8 rounded-full mr-2"
                      />
                    ) : (
                      <User className="h-5 w-5 mr-2" />
                    )}
                    <span>{user?.name || 'Mi Cuenta'}</span>
                  </button>

                  {showAccountMenu && (
                    <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg py-1 z-50">
                      <div className="px-4 py-2 border-b border-gray-200">
                        <p className="text-sm font-medium text-gray-900">{user?.name}</p>
                        <p className="text-xs text-gray-500">{user?.email}</p>
                      </div>
                      <Link
                        to="/profile"
                        className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center"
                      >
                        <Settings className="h-4 w-4 mr-2" />
                        Configuración
                      </Link>
                      <Link
                        to="/change-password"
                        className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center"
                      >
                        <Key className="h-4 w-4 mr-2" />
                        Cambiar contraseña
                      </Link>
                      <button 
                        onClick={handleLogout}
                        className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center"
                      >
                        <LogOut className="h-4 w-4 mr-2" />
                        Cerrar sesión
                      </button>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <>
                <Link to="/login" className="px-3 py-2 rounded-md hover:bg-green-700">Ingresar</Link>
                <Link to="/register" className="px-3 py-2 bg-white text-green-600 font-medium rounded-md hover:bg-gray-100">
                  Registrarse
                </Link>
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
        <div className="md:hidden">
          <div className="px-2 pt-2 pb-3 space-y-1 sm:px-3">
            <Link to="/" className="block px-3 py-2 rounded-md hover:bg-green-700">Inicio</Link>
            <Link to="/collection-points" className="block px-3 py-2 rounded-md hover:bg-green-700">Puntos de Recolección</Link>
            
            {isAuthenticated ? (
              <>
                <Link to="/dashboard" className="block px-3 py-2 rounded-md hover:bg-green-700">
                  Mi Panel
                </Link>
                <div className="border-t border-green-700 mt-2 pt-2">
                  <div className="px-3 py-2">
                    <p className="font-medium">{user?.name}</p>
                    <p className="text-sm text-green-200">{user?.email}</p>
                  </div>
                  <Link
                    to="/profile"
                    className="block px-3 py-2 rounded-md hover:bg-green-700 flex items-center"
                  >
                    <Settings className="h-4 w-4 mr-2" />
                    Configuración
                  </Link>
                  <Link
                    to="/change-password"
                    className="block px-3 py-2 rounded-md hover:bg-green-700 flex items-center"
                  >
                    <Key className="h-4 w-4 mr-2" />
                    Cambiar contraseña
                  </Link>
                  <button 
                    onClick={handleLogout}
                    className="block w-full text-left px-3 py-2 rounded-md hover:bg-green-700 flex items-center"
                  >
                    <LogOut className="h-4 w-4 mr-2" />
                    Cerrar sesión
                  </button>
                </div>
              </>
            ) : (
              <>
                <Link to="/login" className="block px-3 py-2 rounded-md hover:bg-green-700">Ingresar</Link>
                <Link to="/register" className="block px-3 py-2 bg-white text-green-600 font-medium rounded-md hover:bg-gray-100">
                  Registrarse
                </Link>
              </>
            )}
          </div>
        </div>
      )}
    </nav>
  );
};

export default Navbar;