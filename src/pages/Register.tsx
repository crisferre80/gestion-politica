import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useUser } from '../context/UserContext';
import { signUpUser } from '../lib/supabase';
import { uploadAvatar, updateProfileAvatar } from '../lib/uploadAvatar';
import { supabase } from '../lib/supabase';
import PhotoCapture from '../components/PhotoCapture';
import { createNotification } from '../lib/notifications';

const Register: React.FC = () => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [userType, setUserType] = useState<'recycler' | 'resident'>('resident');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [profilePhoto, setProfilePhoto] = useState<File | null>(null);
  const [bio, setBio] = useState('');
  const [materials, setMaterials] = useState('');
  const [experienceYears, setExperienceYears] = useState(0);
  
  const { login } = useUser();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (password !== confirmPassword) {
      setError('Las contraseñas no coinciden');
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await signUpUser(email, password, {
        name,
        type: userType,
        email,
        bio,
        materials: materials.split(',').map((m) => m.trim()).filter(Boolean),
        experience_years: userType === 'recycler' ? experienceYears : undefined,
      });
      if (error) {
        // Mostrar el mensaje real del error
        if (error.message === 'User already registered') {
          setError('Este correo electrónico ya está registrado. Por favor, inicia sesión o utiliza otro correo.');
        } else if (error.message) {
          setError(error.message);
        } else {
          setError(JSON.stringify(error));
        }
        setLoading(false);
        return;
      }
      let avatarUrl: string | undefined = undefined;
      if (data?.user && profilePhoto) {
        try {
          const url = await uploadAvatar(data.user.id, profilePhoto);
          if (url) {
            await updateProfileAvatar(data.user.id, url);
            avatarUrl = url;
          }
        } catch (err) {
          console.error('Error subiendo avatar:', err);
        }
      }
      // Notificación para el nuevo usuario
      if (data?.user) {
        await createNotification({
          user_id: data.user.id,
          title: '¡Bienvenido a EcoConecta!',
          content: 'Tu registro fue exitoso. Ya puedes comenzar a usar la plataforma.',
          type: 'user_registered',
        });
        // Fetch perfil actualizado para obtener avatar_url real
        let updatedProfile = null;
        try {
          const { data: profile } = await supabase
            .from('profiles')
            .select('*')
            .eq('user_id', data.user.id)
            .maybeSingle();
          updatedProfile = profile;
        } catch {
          // Error al obtener el perfil actualizado, se ignora intencionalmente
        }
        login({
            id: data.user.id,
            name,
            email: data.user.email!,
            type: userType,
            lng: 0,
            lat: 0,
            avatar_url: updatedProfile?.avatar_url || avatarUrl,
            experience_years: 0
        });
        navigate('/dashboard');
      } else {
        setError('Error al crear el usuario. Por favor, intenta nuevamente.');
      }
    } catch (err: unknown) {
      // Mostrar el mensaje real del error
      console.error('Registration error:', err);
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError(JSON.stringify(err));
      }
    } finally {
      setLoading(false);
    }
  };

  const handlePhotoCapture = (file: File) => {
    setProfilePhoto(file);
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
          Crear una cuenta
        </h2>
        <p className="mt-2 text-center text-sm text-gray-600">
          ¿Ya tienes una cuenta?{' '}
          <Link to="/login" className="font-medium text-green-600 hover:text-green-500">
            Inicia sesión
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
              <label className="block text-sm font-medium text-gray-700">
                Tipo de usuario
              </label>
              <div className="mt-2 grid grid-cols-2 gap-3">
                <div>
                  <button
                    type="button"
                    onClick={() => setUserType('resident')}
                    className={`w-full py-2 px-3 border rounded-md shadow-sm text-sm font-medium focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 ${
                      userType === 'resident'
                        ? 'bg-green-600 text-white border-green-600'
                        : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    Residente
                  </button>
                </div>
                <div>
                  <button
                    type="button"
                    onClick={() => setUserType('recycler')}
                    className={`w-full py-2 px-3 border rounded-md shadow-sm text-sm font-medium focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 ${
                      userType === 'recycler'
                        ? 'bg-green-600 text-white border-green-600'
                        : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    Reciclador
                  </button>
                </div>
              </div>
            </div>

            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-700">
                Nombre completo
              </label>
              <div className="mt-1">
                <input
                  id="name"
                  name="name"
                  type="text"
                  autoComplete="name"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm"
                />
              </div>
            </div>

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
                  autoComplete="new-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm"
                />
              </div>
            </div>

            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700">
                Confirmar contraseña
              </label>
              <div className="mt-1">
                <input
                  id="confirmPassword"
                  name="confirmPassword"
                  type="password"
                  autoComplete="new-password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Foto de perfil
              </label>
              <PhotoCapture onCapture={handlePhotoCapture} onCancel={function (): void {
                throw new Error('Function not implemented.');
              } } />
              {profilePhoto && (
                <p className="mt-2 text-sm text-green-600">
                  Foto seleccionada: {profilePhoto.name}
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">
                Biografía / Nota
              </label>
              <textarea
                className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm"
                value={bio}
                onChange={e => setBio(e.target.value)}
                placeholder="Cuéntanos sobre ti o tu experiencia en reciclaje"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Materiales que reciclas (separados por coma)
              </label>
              <input
                className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm"
                value={materials}
                onChange={e => setMaterials(e.target.value)}
                placeholder="Ej: Papel, Plástico, Vidrio"
              />
            </div>
            {userType === 'recycler' && (
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Años de experiencia
                </label>
                <input
                  type="number"
                  min="0"
                  className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm"
                  value={experienceYears}
                  onChange={e => setExperienceYears(Number(e.target.value))}
                  placeholder="Ej: 5"
                />
              </div>
            )}

            <div>
              <button
                type="submit"
                disabled={loading}
                className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50"
              >
                {loading ? 'Registrando...' : 'Registrarse'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default Register;