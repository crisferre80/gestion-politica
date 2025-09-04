import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useUser } from '../context/UserContext';
import { signUpUser } from '../lib/supabase';
import { uploadAvatar, updateProfileAvatar } from '../lib/uploadAvatar';
import PhotoCapture from '../components/PhotoCapture';
import { createNotification } from '../lib/notifications';

const Register: React.FC = () => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  // userType maps to backend role values. Actualizamos:
  // 'recycler' => Referente
  // 'resident' => Vecino
  // 'fiscal' => Fiscal
  const [userType, setUserType] = useState<'recycler' | 'resident' | 'fiscal'>('resident');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [profilePhoto, setProfilePhoto] = useState<File | null>(null);
  const [bio, setBio] = useState('');
  const [materials, setMaterials] = useState('');
  const [experienceYears, setExperienceYears] = useState(0);
  const [alias, setAlias] = useState('');
  const [institutionAddress, setInstitutionAddress] = useState('');
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [showPhotoCapture, setShowPhotoCapture] = useState(false);
  const [dni, setDni] = useState('');
  // Institutional mode removed — app now supports only Dirigentes y Referentes
  
  const { login } = useUser();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!acceptedTerms) {
      setError('Debes aceptar los Términos y Condiciones para registrarte.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Las contraseñas no coinciden');
      return;
    }
    if (userType === 'recycler' && !dni.trim()) {
      setError('El DNI es obligatorio para Dirigentes.');
      return;
    }
    setLoading(true);
    try {
      // Si es institucional, el type será 'resident_institutional'
      const typeToSend = userType; // 'recycler' o 'resident'
      const { data, error } = await signUpUser(email, password, {
        name,
        type: typeToSend,
        email,
        bio,
        address: undefined,
        materials: materials.split(',').map((m) => m.trim()).filter(Boolean),
        experience_years: userType === 'recycler' ? experienceYears : undefined,
        dni: userType === 'recycler' ? dni.trim() : undefined,
      });
      if (error) {
        // Manejo robusto de errores de usuario ya registrado
        const msg = error.message?.toLowerCase() || '';
        if (
          (typeof error === 'object' && error !== null && 'status' in error && (error as { status?: number }).status === 422) ||
          msg.includes('already registered') ||
          msg.includes('already exists') ||
          msg.includes('user exists')
        ) {
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
  // Si es dirigente (recycler) y hay alias, actualizar el perfil con alias
  if (data?.user && userType === 'recycler' && alias.trim()) {
        try {
          const { updateProfileByUserId } = await import('../lib/profileHelpers');
          await updateProfileByUserId(data.user.id, { alias: alias.trim() });
        } catch (e) {
          console.warn('No se pudo actualizar alias en Register:', e);
        }
      }
      // Notificación para el nuevo usuario
      if (data?.user) {
        try {
          await createNotification({
            user_id: data.user.id,
            title: '¡Bienvenido a EcoNecta2!',
            content: 'Tu registro fue exitoso. Ya puedes comenzar a usar la plataforma.',
            type: 'user_registered',
            user_name: name,
            user_email: email
          });
        } catch {
          setError('El usuario fue registrado, pero no se pudo enviar la notificación de bienvenida.');
        }
        // Fetch perfil actualizado para obtener avatar_url real
        let updatedProfile = null;
        try {
          const { resolveProfileRow } = await import('../lib/profileHelpers');
          updatedProfile = await resolveProfileRow(data.user.id);
        } catch {
          // Ignorar errores al obtener perfil actualizado
        }
          login({
                  id: data.user.id,
                  user_id: data.user.id,
                  profileId: updatedProfile?.id || '',
                  name,
                  email: data.user.email!,
                  type: userType,
                  lng: 0,
                  lat: 0,
                  avatar_url: updatedProfile?.avatar_url || avatarUrl,
                  header_image_url: updatedProfile?.header_image_url,
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


  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
          Crear una cuenta
        </h2>
        <p className="mt-2 text-center text-sm text-gray-600">
          ¿Ya tienes una cuenta?{' '}
          <Link to="/login" className="font-medium text-blue-600 hover:text-blue-500">
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
                    onClick={() => { setUserType('recycler'); }}
                    className={`w-full py-2 px-3 border rounded-md shadow-sm text-sm font-medium focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 ${userType === 'recycler' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'}`}
                  >
                    Referente
                  </button>
                </div>
                <div>
                  <button
                    type="button"
                    onClick={() => setUserType('resident')}
                    className={`w-full py-2 px-3 border rounded-md shadow-sm text-sm font-medium focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 ${userType === 'resident' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'}`}
                  >
                    Vecino
                  </button>
                </div>
                <div>
                  <button
                    type="button"
                    onClick={() => setUserType('fiscal')}
                    className={`w-full py-2 px-3 border rounded-md shadow-sm text-sm font-medium focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 ${userType === 'fiscal' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'}`}
                  >
                    Fiscal
                  </button>
                </div>
              </div>
            </div>

            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-700">
                Nombre de Usuario <span className="text-red-600 cursor-pointer group relative">*
                  <span className="absolute left-4 top-0 z-10 hidden group-hover:block bg-white border border-gray-300 text-xs text-gray-700 rounded px-2 py-1 shadow-lg whitespace-nowrap">Campo obligatorio</span>
                </span>
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
                  className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                />
              </div>
            </div>

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                Correo electrónico <span className="text-red-600 cursor-pointer group relative">*
                  <span className="absolute left-4 top-0 z-10 hidden group-hover:block bg-white border border-gray-300 text-xs text-gray-700 rounded px-2 py-1 shadow-lg whitespace-nowrap">Campo obligatorio</span>
                </span>
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
                  className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                Contraseña <span className="text-red-600 cursor-pointer group relative">*
                  <span className="absolute left-4 top-0 z-10 hidden group-hover:block bg-white border border-gray-300 text-xs text-gray-700 rounded px-2 py-1 shadow-lg whitespace-nowrap">Campo obligatorio</span>
                </span>
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
                  className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                />
              </div>
            </div>

            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700">
                Confirmar contraseña <span className="text-red-600 cursor-pointer group relative">*
                  <span className="absolute left-4 top-0 z-10 hidden group-hover:block bg-white border border-gray-300 text-xs text-gray-700 rounded px-2 py-1 shadow-lg whitespace-nowrap">Campo obligatorio</span>
                </span>
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
                  className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Foto de perfil
              </label>
              <button
                type="button"
                className="mb-2 px-4 py-2 bg-yellow-600 text-white rounded hover:bg-yellow-700 focus:outline-none focus:ring-2 focus:ring-blue-500 flex items-center gap-2"
                onClick={() => setShowPhotoCapture(true)}
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 19.5V7.125c0-.621.504-1.125 1.125-1.125h3.38c.414 0 .788-.252.94-.639l.57-1.522A1.125 1.125 0 018.21 3.75h7.58c.482 0 .915.304 1.07.764l.57 1.522c.152.387.526.639.94.639h3.38c.621 0 1.125.504 1.125 1.125V19.5a1.125 1.125 0 01-1.125 1.125H3.375A1.125 1.125 0 012.25 19.5z" />
                  <circle cx="12" cy="13.5" r="3.75" />
                </svg>
                Tomar foto
              </button>
              {showPhotoCapture && (
                <PhotoCapture
                  onCapture={(file) => {
                    setProfilePhoto(file);
                    setShowPhotoCapture(false);
                  }}
                  onCancel={() => setShowPhotoCapture(false)}
                />
              )}
              {profilePhoto && (
                <p className="mt-2 text-sm text-blue-600">
                  Foto seleccionada: {profilePhoto.name}
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">
                Biografía / Nota
              </label>
              <textarea
                className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
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
                className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                value={materials}
                onChange={e => setMaterials(e.target.value)}
                placeholder="Ej: Papel, Plástico, Vidrio"
              />
            </div>
            {userType === 'recycler' && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Años de experiencia
                  </label>
                  <input
                    type="number"
                    min="0"
                    className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    value={experienceYears}
                    onChange={e => setExperienceYears(Number(e.target.value))}
                    placeholder="Ej: 5"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Alias público (opcional)
                  </label>
                  <input
                    className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    value={alias}
                    onChange={e => setAlias(e.target.value)}
                    placeholder="Ej: El Reciclador Verde"
                  />
                </div>
                <div>
                  <label htmlFor="dni" className="block text-sm font-medium text-gray-700">
                    DNI <span className="text-red-600">*</span>
                  </label>
                  <div className="mt-1">
                    <input
                      id="dni"
                      name="dni"
                      type="text"
                      required
                      value={dni}
                      onChange={e => setDni(e.target.value)}
                      className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    />
                  </div>
                </div>
              </>
            )}
            {/* Institutional registration removed — only Dirigentes and Referentes supported */}
            {userType === 'resident' && (
              <div>
                <label className="block text-sm font-medium text-gray-700">¿Vives en un edificio/institución? Escribe la dirección colectiva (opcional)</label>
                <input
                  className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  value={institutionAddress}
                  onChange={e => setInstitutionAddress(e.target.value)}
                  placeholder="Si tu edificio ya tiene punto colectivo, escribe la dirección exacta"
                />
              </div>
            )}

            <div className="flex items-center">
              <input
                id="acceptedTerms"
                name="acceptedTerms"
                type="checkbox"
                checked={acceptedTerms}
                onChange={e => setAcceptedTerms(e.target.checked)}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                required
              />
              <label htmlFor="acceptedTerms" className="ml-2 block text-sm text-gray-700">
                <span className="text-red-600 mr-1">*</span>
                Acepto los{' '}
                <a
                  href="/terminos-condiciones"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-700 underline hover:text-blue-900"
                >
                  Términos y Condiciones
                </a>{' '}de la app
                <span className="ml-1 text-xs text-gray-400">(Obligatorio)</span>
              </label>
            </div>

            <div>
              <button
                type="submit"
                disabled={loading}
                className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
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