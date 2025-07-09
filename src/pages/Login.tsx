import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useUser } from '../context/UserContext';
import { signInUser } from '../lib/supabase';

const Login: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  
  const { login } = useUser();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { data, profile } = await signInUser(email, password);
      if (data.user && profile) {
        // Marcar online en el backend
        await import('../lib/supabase').then(({ supabase }) =>
          supabase.from('profiles').update({ online: true }).eq('user_id', data.user.id)
        );
        login({
          id: data.user.id,
          profileId: profile.id, // <-- ID interno de profiles
          email: data.user.email!,
          name: profile.name || '',
          type: profile.type,
          role: profile.role, // <-- Asegura que el rol esté presente
          avatar_url: profile.avatar_url,
          header_image_url: profile.header_image_url, // <-- Incluir imagen de header
          phone: profile.phone,
          address: profile.address,
          online: true,
          lng: 0,
          lat: 0,
          user_id: ''
        });
        // Guardar email en localStorage para mostrar acceso admin en Home
        window.localStorage.setItem('eco_user_email', data.user.email!);
        if (email === 'cristianferreyra8076@gmail.com') {
          navigate('/admin-panel');
        } else if (profile.type === 'resident_institutional') {
          navigate('/dashboard-institutional');
        } else {
          navigate('/dashboard');
        }
      } else {
        setError('No se pudo iniciar sesión. Por favor, verifica tus credenciales.');
      }
    } catch (err: unknown) {
      console.error('Login error:', err);
      if (err instanceof Error) {
        if (err.message === 'Invalid login credentials') {
          setError('Correo electrónico o contraseña incorrectos.');
        } else if (err.message === 'Profile not found. Please contact support.') {
          setError('No se encontró el perfil. Por favor, contacta con soporte.');
        } else {
          setError('Error al iniciar sesión. Por favor, intenta nuevamente.');
        }
      } else {
        setError('Error al iniciar sesión. Por favor, intenta nuevamente.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="flex flex-col md:flex-row items-center justify-center gap-8 w-full max-w-4xl mx-auto px-2 md:px-8">
        <div className="flex-1 w-full max-w-md order-2 md:order-1">
          <div className="sm:mx-auto sm:w-full sm:max-w-md flex flex-col items-center">
            <h2 className="mt-2 text-center text-3xl font-extrabold text-gray-900">
              Iniciar Sesión
            </h2>
            <p className="mt-2 text-center text-sm text-gray-600">
              ¿No tienes una cuenta?{' '}
              <Link to="/register" className="font-medium text-green-600 hover:text-green-500">
                Regístrate
              </Link>
            </p>
          </div>

          <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
            <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
              {error && (
                <div className="bg-red-50 border-l-4 border-red-400 p-4 mb-6">
                  <div className="flex">
                    <div className="ml-3">
                      <p className="text-sm text-red-700">{error}</p>
                    </div>
                  </div>
                </div>
              )}
              
              <form className="space-y-6" onSubmit={handleSubmit}>
                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                    Correo electrónico
                  </label>
                  <div className="mt-1">
                    <input
                      id="email"
                      name="email"
                      type="email"
                      autoComplete="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                    Contraseña
                  </label>
                  <div className="mt-1">
                    <input
                      id="password"
                      name="password"
                      type="password"
                      autoComplete="current-password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <input
                      id="remember-me"
                      name="remember-me"
                      type="checkbox"
                      className="h-4 w-4 text-green-600 focus:ring-green-500 border-gray-300 rounded"
                    />
                    <label htmlFor="remember-me" className="ml-2 block text-sm text-gray-900">
                      Recordarme
                    </label>
                  </div>

                  <div className="text-sm">
                    <a href="#" className="font-medium text-green-600 hover:text-green-500">
                      ¿Olvidaste tu contraseña?
                    </a>
                  </div>
                </div>

                <div>
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50"
                  >
                    {loading ? 'Iniciando sesión...' : 'Iniciar sesión'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
        {/* Imagen portada: solo visible en desktop, nunca desplaza el formulario */}
        <div className="hidden md:flex flex-1 justify-center items-center order-1 md:order-2">
          <img
            src="https://res.cloudinary.com/dhvrrxejo/image/upload/v1745694849/portada_app_jdttpr.png"
            alt="Portada EcoNecta"
            width={180}
            height={280}
            className="w-80 h-90 object-cover rounded-2xl shadow-xl border-4 border-green-200"
            style={{ minWidth: 0 }}
          />
        </div>
      </div>
    </div>
  );
};

export default Login;