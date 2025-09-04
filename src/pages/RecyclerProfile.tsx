import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useUser } from '../context/UserContext';
import { supabase } from '../lib/supabase';
import { ArrowLeft, Mail, Phone, MapPin } from 'lucide-react';
import PhotoCapture from '../components/PhotoCapture';

const RecyclerProfile: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  useUser();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editAddress, setEditAddress] = useState('');
  const [editBio, setEditBio] = useState('');
  const [editMaterials, setEditMaterials] = useState('');
  const [editAlias, setEditAlias] = useState('');
  const [editDni, setEditDni] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [uploading, setUploading] = useState(false);
  // Ratings removed: la funcionalidad de calificaciones fue eliminada del frontend.
  // Move fetchProfile outside useEffect so it's accessible elsewhere
  const fetchProfile = React.useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const { resolveProfileRow } = await import('../lib/profileHelpers');
      const data = await resolveProfileRow(id || '');
      if (!data) {
        setError('No se pudo cargar el perfil');
        setLoading(false);
        return;
      }
      if (!data) {
        setError('No se pudo cargar el perfil');
        setLoading(false);
        return;
      }
    
    } catch (err) {
      setError('No se pudo cargar el perfil');
      setLoading(false);
      return;
    }
    // ahora recargamos el perfil usando la misma lógica
    try {
      const { resolveProfileRow } = await import('../lib/profileHelpers');
      const profile = await resolveProfileRow(id || '');
      if (!profile) {
        setError('No se pudo cargar el perfil');
        setLoading(false);
        return;
      }
      setEditName(profile.name || '');
      setEditEmail(profile.email || '');
      setEditPhone(profile.phone || '');
      setEditAddress(profile.address || '');
      setEditBio(profile.bio || '');
      setEditMaterials(Array.isArray(profile.materials) ? profile.materials.join(', ') : '');
      setEditAlias(profile.alias || '');
      setEditDni(profile.dni || '');
      setAvatarUrl(profile.avatar_url || '');
      setLoading(false);
    } catch (e) {
      setError('No se pudo cargar el perfil');
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    if (id) fetchProfile();
  }, [id, fetchProfile]);

  // Nota: lógica de ratings eliminada intencionalmente.

  if (loading) return <div className="min-h-screen flex items-center justify-center">Cargando...</div>;
  if (error) return <div className="min-h-screen flex items-center justify-center text-red-600">{error}</div>;

  return (
    <div className="bg-gray-50 min-h-screen py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <Link to="/dashboard-recycler" className="flex items-center text-blue-600 hover:text-blue-700 mb-6">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Volver al panel
        </Link>
        <div className="bg-white shadow rounded-lg overflow-hidden">
          {/* Profile Header */}
          <div className="bg-blue-600 text-white p-6">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between">
                <div>
                  <h1 className="text-2xl font-bold">{editName}</h1>
                  {/* Calificaciones removidas */}
                </div>
                <button className="mt-4 md:mt-0 bg-white text-blue-600 px-4 py-2 rounded-md font-medium hover:bg-gray-100 transition">
                  Contactar
                </button>
        </div>
      </div>
      {/* Profile Content */}
          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Left Column - Contact Info */}
              <div className="md:col-span-1">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Información de Contacto</h2>
                <ul className="space-y-3">
                  <li className="flex items-start"><Mail className="h-5 w-5 text-blue-500 mr-3 mt-0.5" /><span>{editEmail}</span></li>
                  <li className="flex items-start"><Phone className="h-5 w-5 text-blue-500 mr-3 mt-0.5" /><span>{editPhone}</span></li>
                  <li className="flex items-start"><MapPin className="h-5 w-5 text-blue-500 mr-3 mt-0.5" /><span>{editAddress}</span></li>
                  <li className="flex items-start"><span className="font-semibold text-blue-700 mr-3 mt-0.5">DNI:</span><span>{editDni}</span></li>
                  {/* Puedes agregar más campos aquí */}
                </ul>
                <h2 className="text-lg font-semibold text-gray-900 mt-6 mb-4">Materiales que Recolecta</h2>
                <div className="flex flex-wrap gap-2">
                  {editMaterials.split(',').map((material, index) => (
                    <span key={index} className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm">{material.trim()}</span>
                  ))}
                </div>
              </div>
             
              {/* Edit Profile Section */}
              <div className="md:col-span-3 mt-8 border-t border-gray-200 pt-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Editar Perfil</h3>
                  <div className="w-24 h-24 rounded-full overflow-hidden mb-3 flex items-center justify-center bg-gray-200 border-2 border-blue-600">
                    <img src={avatarUrl || 'https://ui-avatars.com/api/?name=' + encodeURIComponent(editName || 'Reciclador') + '&background=22c55e&color=fff&size=128'} alt="Foto de perfil" className="w-full h-full object-cover" />
                  </div>
                  <PhotoCapture onCapture={async (file) => {
                    setUploading(true);
                    try {
                      const fileExt = file.name.split('.').pop();
                      const fileName = `${id}_${Date.now()}.${fileExt}`;
                      const { error: uploadError } = await supabase.storage.from('avatars').upload(fileName, file, { upsert: true });
                      if (uploadError) throw new Error('Error al subir la imagen');
                      const { data } = supabase.storage.from('avatars').getPublicUrl(fileName);
                      const publicUrl = data.publicUrl;
                      if (!publicUrl) throw new Error('No se pudo obtener la URL de la imagen');
                      try {
                        const { updateProfileByUserId } = await import('../lib/profileHelpers');
                        const res = await updateProfileByUserId(id || '', { avatar_url: publicUrl });
                        if (res.error) throw new Error('No se pudo actualizar el perfil con la foto');
                      } catch (err) {
                        throw new Error('No se pudo actualizar el perfil con la foto');
                      }
                      setAvatarUrl(publicUrl);
                    } catch {
                      // Puedes mostrar un toast de error
                    }
                    setUploading(false);
                  }} onCancel={() => {}} />
                  <form className="w-full mt-4 grid grid-cols-1 md:grid-cols-2 gap-4" onSubmit={async (e) => {
                    e.preventDefault();
                    const updateObj: Record<string, unknown> = {};
                    if (editName && editName.trim()) updateObj.name = editName.trim();
                    if (editEmail && editEmail.trim()) updateObj.email = editEmail.trim();
                    if (editPhone && editPhone.trim()) updateObj.phone = editPhone.trim();
                    if (editAddress && editAddress.trim()) updateObj.address = editAddress.trim();
                    if (editBio && editBio.trim()) updateObj.bio = editBio.trim();
                    if (editMaterials && editMaterials.trim()) {
                      updateObj.materials = editMaterials.split(',').map((m: string) => m.trim()).filter(Boolean);
                    }
                    if (editAlias && editAlias.trim()) updateObj.alias = editAlias.trim();
                    if (editDni && editDni.trim()) updateObj.dni = editDni.trim();
                    try {
                      const { updateProfileByUserId } = await import('../lib/profileHelpers');
                      const res = await updateProfileByUserId(id || '', updateObj);
                      if (res.error) console.warn('No se pudo actualizar el perfil:', res.error);
                    } catch (err) {
                      console.warn('No se pudo actualizar el perfil:', err);
                    }
                    await fetchProfile(); // <-- Refresca el perfil tras actualizar
                  }}>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Nombre completo</label>
                      <input className="font-semibold w-full border rounded px-2 py-1" value={editName} onChange={e => setEditName(e.target.value)} />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Email</label>
                      <input className="font-semibold w-full border rounded px-2 py-1" value={editEmail} onChange={e => setEditEmail(e.target.value)} />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Teléfono</label>
                      <input className="font-semibold w-full border rounded px-2 py-1" value={editPhone} onChange={e => setEditPhone(e.target.value)} />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Domicilio</label>
                      <input className="font-semibold w-full border rounded px-2 py-1" value={editAddress} onChange={e => setEditAddress(e.target.value)} />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Alias</label>
                      <input className="font-semibold w-full border rounded px-2 py-1" value={editAlias} onChange={e => setEditAlias(e.target.value)} />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">DNI</label>
                      <input className="font-semibold w-full border rounded px-2 py-1" value={editDni} onChange={e => setEditDni(e.target.value)} required />
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-700">Biografía / Nota</label>
                      <textarea className="font-semibold w-full border rounded px-2 py-1" value={editBio} onChange={e => setEditBio(e.target.value)} />
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-700">Materiales (separados por coma)</label>
                      <input className="font-semibold w-full border rounded px-2 py-1" value={editMaterials} onChange={e => setEditMaterials(e.target.value)} />
                    </div>
                    <button type="submit" className="mt-4 px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700" disabled={uploading}>Actualizar Perfil</button>
                  </form>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
  );
};

export default RecyclerProfile;