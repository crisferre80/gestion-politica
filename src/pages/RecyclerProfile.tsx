import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useUser } from '../context/UserContext';
import { supabase } from '../lib/supabase';
import { ArrowLeft, Mail, Phone, MapPin, Star } from 'lucide-react';
import PhotoCapture from '../components/PhotoCapture';

const RecyclerProfile: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { user } = useUser();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editAddress, setEditAddress] = useState('');
  const [editBio, setEditBio] = useState('');
  const [editMaterials, setEditMaterials] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [uploading, setUploading] = useState(false);
  type Review = {
    id: string;
    recycler_id: string;
    rater_id: string;
    rating: number;
    comment: string;
    created_at: string;
  };
  
  const [reviews, setReviews] = useState<Review[]>([]);
  const [ratingAverage, setRatingAverage] = useState<number>(0);
  const [reviewRating, setReviewRating] = useState(0);
  const [reviewComment, setReviewComment] = useState('');
  const [reviewLoading, setReviewLoading] = useState(false);
  const [reviewSuccess, setReviewSuccess] = useState('');
  const [reviewError, setReviewError] = useState('');

  useEffect(() => {
    const fetchProfile = async () => {
      setLoading(true);
      setError('');
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', id)
        .single();
      if (error || !data) {
        setError('No se pudo cargar el perfil');
        setLoading(false);
        return;
      }
      setEditName(data.name || '');
      setEditEmail(data.email || '');
      setEditPhone(data.phone || '');
      setEditAddress(data.address || '');
      setEditBio(data.bio || '');
      setEditMaterials(Array.isArray(data.materials) ? data.materials.join(', ') : '');
      setAvatarUrl(data.avatar_url || '');
      setLoading(false);
    };
    if (id) fetchProfile();
  }, [id]);

  // Fetch ratings and reviews
  useEffect(() => {
    const fetchRatings = async () => {
      if (!id) return;
      const { data, error } = await supabase
        .from('recycler_ratings')
        .select('*')
        .eq('recycler_id', id)
        .order('created_at', { ascending: false });
      if (!error && data) {
        setReviews(data);
        if (data.length > 0) {
          const avg = data.reduce((acc, r) => acc + (r.rating || 0), 0) / data.length;
          setRatingAverage(Number(avg.toFixed(2)));
        } else {
          setRatingAverage(0);
        }
      }
    };
    fetchRatings();
  }, [id, reviewSuccess]);



  // Handle review submit
  const handleReviewSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setReviewError('');
    setReviewSuccess('');
    if (!reviewRating) {
      setReviewError('Por favor selecciona una calificación.');
      return;
    }
    setReviewLoading(true);
    try {
      const { error } = await supabase.from('recycler_ratings').insert({
        recycler_id: id,
        rater_id: user?.id,
        rating: reviewRating,
        comment: reviewComment,
      });
      if (error) throw error;
      setReviewSuccess('¡Reseña enviada correctamente!');
      setReviewRating(0);
      setReviewComment('');
    } catch {
      setReviewError('Error al enviar la reseña.');
    } finally {
      setReviewLoading(false);
    }
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center">Cargando...</div>;
  if (error) return <div className="min-h-screen flex items-center justify-center text-red-600">{error}</div>;

  return (
    <div className="bg-gray-50 min-h-screen py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <Link to="/dashboard-recycler" className="flex items-center text-green-600 hover:text-green-700 mb-6">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Volver al panel
        </Link>
        <div className="bg-white shadow rounded-lg overflow-hidden">
          {/* Profile Header */}
          <div className="bg-green-600 text-white p-6">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between">
              <div>
                <h1 className="text-2xl font-bold">{editName}</h1>
                <div className="flex items-center mt-2">
                  <Star className="h-5 w-5 text-yellow-300 mr-1" />
                  <span className="font-medium">{ratingAverage}</span>
                  <span className="mx-2 text-green-200">•</span>
                  <span>{reviews.length} reseñas</span>
                </div>
              </div>
              <button className="mt-4 md:mt-0 bg-white text-green-600 px-4 py-2 rounded-md font-medium hover:bg-gray-100 transition">
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
                  <li className="flex items-start"><Mail className="h-5 w-5 text-green-500 mr-3 mt-0.5" /><span>{editEmail}</span></li>
                  <li className="flex items-start"><Phone className="h-5 w-5 text-green-500 mr-3 mt-0.5" /><span>{editPhone}</span></li>
                  <li className="flex items-start"><MapPin className="h-5 w-5 text-green-500 mr-3 mt-0.5" /><span>{editAddress}</span></li>
                  {/* Puedes agregar más campos aquí */}
                </ul>
                <h2 className="text-lg font-semibold text-gray-900 mt-6 mb-4">Materiales que Recolecta</h2>
                <div className="flex flex-wrap gap-2">
                  {editMaterials.split(',').map((material, index) => (
                    <span key={index} className="bg-green-100 text-green-800 px-3 py-1 rounded-full text-sm">{material.trim()}</span>
                  ))}
                </div>
              </div>
              {/* Right Column - Bio and Reviews */}
              <div className="md:col-span-2">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Acerca de</h2>
                <p className="text-gray-600 mb-8">{editBio}</p>
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Reseñas</h2>
                {reviews.length > 0 ? (
                  <div className="space-y-6">
                    {reviews.map((review) => (
                      <div key={review.id} className="border-b border-gray-200 pb-6 last:border-b-0">
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="font-medium text-gray-900">{review.rater_id?.slice(0, 8) || 'Usuario'}</p>
                            <p className="text-sm text-gray-500">{new Date(review.created_at).toLocaleDateString()}</p>
                          </div>
                          <div className="flex items-center">
                            {[...Array(5)].map((_, i) => (
                              <Star key={i} className={`h-4 w-4 ${i < review.rating ? 'text-yellow-400' : 'text-gray-300'}`} fill="currentColor" />
                            ))}
                          </div>
                        </div>
                        <p className="mt-2 text-gray-600">{review.comment}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-500">No hay reseñas disponibles.</p>
                )}
                {/* Add Review Form */}
                <div className="mt-8 border-t border-gray-200 pt-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Dejar una Reseña</h3>
                  <form onSubmit={handleReviewSubmit}>
                    <div className="mb-4">
                      <label className="block text-sm font-medium text-gray-700 mb-2">Calificación</label>
                      <div className="flex">
                        {[1, 2, 3, 4, 5].map((rating) => (
                          <button
                            key={rating}
                            type="button"
                            className={reviewRating >= rating ? 'text-yellow-400' : 'text-gray-300'}
                            onClick={() => setReviewRating(rating)}
                          >
                            <Star className="h-6 w-6" />
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="mb-4">
                      <label htmlFor="comment" className="block text-sm font-medium text-gray-700 mb-2">Comentario</label>
                      <textarea
                        id="comment"
                        rows={4}
                        className="w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm"
                        placeholder="Comparte tu experiencia con este reciclador..."
                        value={reviewComment}
                        onChange={e => setReviewComment(e.target.value)}
                      />
                    </div>
                    {reviewError && <div className="text-red-600 text-sm mb-2">{reviewError}</div>}
                    {reviewSuccess && <div className="text-green-600 text-sm mb-2">{reviewSuccess}</div>}
                    <button
                      type="submit"
                      className="bg-green-600 text-white px-4 py-2 rounded-md font-medium hover:bg-green-700 transition"
                      disabled={reviewLoading}
                    >
                      {reviewLoading ? 'Enviando...' : 'Enviar Reseña'}
                    </button>
                  </form>
                </div>
                {/* Edit Profile Section */}
                <div className="mt-8 border-t border-gray-200 pt-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Editar Perfil</h3>
                  <div className="w-24 h-24 rounded-full overflow-hidden mb-3 flex items-center justify-center bg-gray-200 border-2 border-green-600">
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
                      const { error: updateError } = await supabase.from('profiles').update({ avatar_url: publicUrl }).eq('user_id', id);
                      if (updateError) throw new Error('No se pudo actualizar el perfil con la foto');
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
                    await supabase.from('profiles').update(updateObj).eq('user_id', id);
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
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-700">Biografía / Nota</label>
                      <textarea className="font-semibold w-full border rounded px-2 py-1" value={editBio} onChange={e => setEditBio(e.target.value)} />
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-700">Materiales (separados por coma)</label>
                      <input className="font-semibold w-full border rounded px-2 py-1" value={editMaterials} onChange={e => setEditMaterials(e.target.value)} />
                    </div>
                    <button type="submit" className="mt-4 px-6 py-2 bg-green-600 text-white rounded hover:bg-green-700" disabled={uploading}>Actualizar Perfil</button>
                  </form>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RecyclerProfile;