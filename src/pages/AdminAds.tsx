import React, { useState, useEffect } from 'react';
import { useUser } from '../context/UserContext';
import { supabase } from '../lib/supabase';
import { Image as ImageIcon, Link as LinkIcon, Trash2 } from 'lucide-react';
import AdminAdsGrid from '../components/AdminAdsGrid';
// import AdminAdsGrid from '../components/AdminAdsGrid';
// If the file exists at a different path, update the import accordingly, for example:
// import AdminAdsGrid from '../components/ads/AdminAdsGrid';

import { Advertisement } from '../types/Advertisement.ts';

const AdminAds: React.FC = () => {
  const { user } = useUser();

  const [ads, setAds] = useState<Advertisement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [uploading, setUploading] = useState(false);
  const [newAd, setNewAd] = useState({
    title: '',
    link: '',
    file: null as File | null,
  });

  if (!user || user.role !== 'admin') {
    return <div className="text-red-600 text-center mt-10 font-bold text-xl">Acceso no autorizado</div>;
  }

  // eslint-disable-next-line react-hooks/rules-of-hooks
  useEffect(() => {
    fetchAds();
  }, []);

  const fetchAds = async () => {
    try {
      const { data, error } = await supabase
        .from('advertisements')
        .select('*')
        .order('created_at', { ascending: false }); // OK: solo columna raíz

      if (error) throw error;
      setAds(data);
    } catch (err) {
      console.error('Error fetching ads:', err);
      setError('Error al cargar las publicidades');
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setNewAd({ ...newAd, file: e.target.files[0] });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAd.file || !newAd.title) {
      setError('Por favor complete todos los campos requeridos');
      return;
    }

    setUploading(true);
    setError('');

    try {
      const fileExt = newAd.file.name.split('.').pop();
      const fileName = `${Date.now()}.${fileExt}`;
      const filePath = `ads/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('advertisements')
        .upload(filePath, newAd.file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('advertisements')
        .getPublicUrl(filePath);

      const { error: insertError } = await supabase
        .from('advertisements')
        .insert([
          {
            title: newAd.title,
            image_url: publicUrl,
            link: newAd.link || null,
            active: true
          }
        ]);

      if (insertError) throw insertError;

      setNewAd({ title: '', link: '', file: null });
      fetchAds();
    } catch (err) {
      console.error('Error uploading ad:', err);
      setError('Error al subir la publicidad');
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      // 1. Limpiar referencias en ads_grid (solo campo ad_id)
      const { error: gridError } = await supabase
        .from('ads_grid')
        .update({ ad_id: null })
        .match({ ad_id: id }); // match es más robusto para nullables
      if (gridError) throw gridError;

      // 2. Eliminar el anuncio
      const { error } = await supabase
        .from('advertisements')
        .delete()
        .eq('id', id);

      if (error) throw error;
      setAds(ads.filter(ad => ad.id !== id));
    } catch (err: unknown) {
      // Mostrar el mensaje real de error de Supabase
      let msg = 'Error al eliminar la publicidad';
      if (typeof err === 'object' && err !== null) {
        if ('message' in err && typeof (err as { message?: string }).message === 'string') msg += `: ${(err as { message?: string }).message}`;
        else if ('error_description' in err && typeof (err as { error_description?: string }).error_description === 'string') msg += `: ${(err as { error_description?: string }).error_description}`;
        else msg += `: Error desconocido: ' + ${JSON.stringify(err)}`;
      }
      setError(msg);
      console.error('Error deleting ad:', err);
    }
  };

  // Mostrar el UID del usuario admin para depuración de RLS
  const adminUID = user?.id;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="bg-white shadow rounded-lg overflow-hidden">
        <div className="p-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-6">Gestionar Publicidades</h1>

          {/* Mostrar UID admin para depuración de RLS */}
          <div className="mb-4 text-xs text-gray-500">UID admin actual: <span className="font-mono">{adminUID}</span></div>

          {error && (
            <div className="bg-red-50 border-l-4 border-red-400 p-4 mb-6">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="mb-8">
            <div className="space-y-4">
              <div>
                <label htmlFor="title" className="block text-sm font-medium text-gray-700">
                  Título <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  id="title"
                  value={newAd.title}
                  onChange={(e) => setNewAd({ ...newAd, title: e.target.value })}
                  className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  required
                />
              </div>

              <div>
                <label htmlFor="link" className="block text-sm font-medium text-gray-700">
                  Enlace
                </label>
                <input
                  type="url"
                  id="link"
                  value={newAd.link}
                  onChange={(e) => setNewAd({ ...newAd, link: e.target.value })}
                  className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  placeholder="https://"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Imagen <span className="text-red-500">*</span>
                </label>
                <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 border-dashed rounded-md">
                  <div className="space-y-1 text-center">
                    <ImageIcon className="mx-auto h-12 w-12 text-gray-400" />
                    <div className="flex text-sm text-gray-600">
                      <label
                        htmlFor="file-upload"
                        className="relative cursor-pointer bg-white rounded-md font-medium text-blue-600 hover:text-blue-500 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-blue-500"
                      >
                        <span>Subir imagen</span>
                        <input
                          id="file-upload"
                          name="file-upload"
                          type="file"
                          className="sr-only"
                          accept="image/*"
                          onChange={handleFileChange}
                          required
                        />
                      </label>
                      <p className="pl-1">o arrastrar y soltar</p>
                    </div>
                    <p className="text-xs text-gray-500">PNG, JPG hasta 10MB</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-4">
              <button
                type="submit"
                disabled={uploading}
                className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                {uploading ? 'Subiendo...' : 'Subir Publicidad'}
              </button>
            </div>
          </form>

          <div className="border-t border-gray-200 pt-6">
            <h2 className="text-lg font-medium text-gray-900 mb-4">Publicidades Activas</h2>
            
            {loading ? (
              <p className="text-center text-gray-500">Cargando publicidades...</p>
            ) : ads.length > 0 ? (
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {ads.map((ad) => (
                  <div key={ad.id} className="bg-gray-50 rounded-lg overflow-hidden shadow">
                    <img
                      src={ad.image_url}
                      alt={ad.title}
                      className="w-full h-48 object-cover"
                    />
                    <div className="p-4">
                      <h3 className="font-medium text-gray-900">{ad.title}</h3>
                      {ad.link && (
                        <a
                          href={ad.link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-blue-600 hover:text-blue-500 flex items-center mt-1"
                        >
                          <LinkIcon className="h-4 w-4 mr-1" />
                          Ver enlace
                        </a>
                      )}
                      <button
                        onClick={() => handleDelete(ad.id)}
                        className="mt-2 flex items-center text-red-600 hover:text-red-500 text-sm"
                      >
                        <Trash2 className="h-4 w-4 mr-1" />
                        Eliminar
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-center text-gray-500">No hay publicidades activas</p>
            )}
          </div>

          <div className="border-t border-gray-200 pt-6 mt-8">
            <h2 className="text-lg font-medium text-gray-900 mb-4">Configurar grilla de auspiciantes</h2>
            <AdminAdsGrid ads={ads} onUpdate={fetchAds} />
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminAds;