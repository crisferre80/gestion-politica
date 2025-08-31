import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { toast } from 'react-hot-toast';
import { Key } from 'lucide-react';
import { Link } from 'react-router-dom';

const ChangePassword = () => {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  // Función para cambiar la contraseña
  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError(null);
    setIsChangingPassword(true);

    try {
      // Validaciones básicas
      if (!currentPassword || !newPassword || !confirmPassword) {
        setPasswordError('Todos los campos son obligatorios');
        return;
      }

      if (newPassword.length < 6) {
        setPasswordError('La nueva contraseña debe tener al menos 6 caracteres');
        return;
      }

      if (newPassword !== confirmPassword) {
        setPasswordError('Las contraseñas no coinciden');
        return;
      }

      if (currentPassword === newPassword) {
        setPasswordError('La nueva contraseña debe ser diferente a la actual');
        return;
      }

      // Intentar cambiar la contraseña usando Supabase Auth
      const { error } = await supabase.auth.updateUser({
        password: newPassword
      });

      if (error) {
        // Si falla, es probable que necesitemos reautenticar al usuario
        if (error.message.includes('session') || error.message.includes('token')) {
          setPasswordError('Sesión expirada. Por favor, inicia sesión nuevamente y vuelve a intentar.');
        } else {
          setPasswordError(`Error al cambiar la contraseña: ${error.message}`);
        }
        return;
      }

      // Éxito
      toast.success('Contraseña actualizada correctamente');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (error) {
      console.error('Error inesperado al cambiar contraseña:', error);
      setPasswordError('Error inesperado. Inténtalo de nuevo.');
    } finally {
      setIsChangingPassword(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex items-center justify-center">
          <Key className="h-8 w-8 text-blue-600 mr-2" />
          <h2 className="text-center text-3xl font-extrabold text-gray-900">
            Cambiar contraseña
          </h2>
        </div>
        <p className="mt-2 text-center text-sm text-gray-600">
          Actualiza tu contraseña de forma segura
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
          <form onSubmit={handlePasswordChange}>
            <div className="space-y-6">
              <div>
                <label htmlFor="currentPassword" className="block text-sm font-medium text-gray-700">
                  Contraseña actual
                </label>
                <input
                  id="currentPassword"
                  name="currentPassword"
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="mt-1 appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  required
                  disabled={isChangingPassword}
                />
              </div>

              <div>
                <label htmlFor="newPassword" className="block text-sm font-medium text-gray-700">
                  Nueva contraseña
                </label>
                <input
                  id="newPassword"
                  name="newPassword"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="mt-1 appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  required
                  minLength={6}
                  disabled={isChangingPassword}
                />
                <p className="mt-1 text-xs text-gray-500">Mínimo 6 caracteres</p>
              </div>

              <div>
                <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700">
                  Confirmar nueva contraseña
                </label>
                <input
                  id="confirmPassword"
                  name="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="mt-1 appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  required
                  disabled={isChangingPassword}
                />
              </div>

              {passwordError && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-md text-sm">
                  {passwordError}
                </div>
              )}

              <div className="flex gap-3">
                <Link
                  to="/dashboard"
                  className="flex-1 flex justify-center py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
                >
                  Cancelar
                </Link>
                <button
                  type="submit"
                  className="flex-1 flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  disabled={isChangingPassword}
                >
                  {isChangingPassword ? 'Cambiando...' : 'Cambiar contraseña'}
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default ChangePassword;
