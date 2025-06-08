import React, { useEffect, useState } from 'react';
import { supabase, ensureUserProfile } from '../lib/supabase';
import { Star } from 'lucide-react';
import { useUser } from '../context/UserContext';

interface RecyclerRatingsModalProps {
  recyclerId: string;
  recyclerName: string;
  avatarUrl?: string;
  open: boolean;
  onClose: () => void;
}

interface Rating {
  rater_id: string;
  id: string;
  rating: number;
  comment: string;
  created_at: string;
  resident_id?: string;
  resident: {
    name?: string;
    avatar_url?: string;
  };
}

const RecyclerRatingsModal: React.FC<RecyclerRatingsModalProps> = ({ recyclerId, recyclerName, avatarUrl, open, onClose }) => {
  const { user } = useUser();
  const userId = user?.id;
  const userProfileId = user?.profileId; // ID interno de profiles
  const [ratings, setRatings] = useState<Rating[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [average, setAverage] = useState<number | null>(null);
  const [myRating, setMyRating] = useState<number>(0);
  const [myComment, setMyComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [alreadyRated, setAlreadyRated] = useState(false);
  const [myExistingRating, setMyExistingRating] = useState<Rating | null>(null);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setError(null);
    setSuccessMsg(null);
    (async () => {
      const { data, error } = await supabase
        .from('recycler_ratings')
        .select('id, rating, comment, created_at, rater_id') // CAMBIO: rater_id
        .eq('recycler_id', recyclerId)
        .order('created_at', { ascending: false });
      if (error) {
        setError('Error al cargar las calificaciones: ' + error.message);
        setRatings([]);
        setAverage(null);
        setLoading(false);
        return;
      }
      const raterIds = (data || []).map(r => r.rater_id).filter(Boolean); // CAMBIO: rater_id
      let profilesById: Record<string, { name?: string; avatar_url?: string }> = {};
      if (raterIds.length > 0) {
        const { data: profilesData, error: profilesError } = await supabase
          .from('profiles')
          .select('id, name, avatar_url')
          .in('id', raterIds);
        if (!profilesError && profilesData) {
          profilesById = profilesData.reduce((acc, p) => {
            acc[p.id] = { name: p.name, avatar_url: p.avatar_url };
            return acc;
          }, {} as Record<string, { name?: string; avatar_url?: string }>);
        }
      }
      const fixedData: Rating[] = (data || []).map((r) => ({
        ...r,
        resident: profilesById[r.rater_id] || {}, // CAMBIO: rater_id
      }));
      setRatings(fixedData);
      if (fixedData.length > 0) {
        const avg = fixedData.reduce((acc, r) => acc + (typeof r.rating === 'number' ? r.rating : 0), 0) / fixedData.length;
        setAverage(avg);
      } else {
        setAverage(null);
      }
      if (userProfileId) {
        const found = fixedData.find(r => r.rater_id === userProfileId);
        if (found) {
          setAlreadyRated(true);
          setMyExistingRating(found);
        } else {
          setAlreadyRated(false);
          setMyExistingRating(null);
        }
      }
      setLoading(false);
    })();
  }, [open, recyclerId, userProfileId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!myRating) {
      setError('Por favor selecciona una calificación.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      // Asegura que el perfil existe antes de insertar (importante para RLS)
      let profileId = userProfileId;
      if (!profileId && userId && user?.email && user?.name) {
        await ensureUserProfile({ id: userId, email: user.email, name: user.name });
        // Buscar el id interno de profiles
        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('id')
          .eq('user_id', userId)
          .maybeSingle();
        if (profileError || !profileData) {
          setError('No se pudo obtener el perfil interno del usuario.');
          setSubmitting(false);
          return;
        }
        profileId = profileData.id;
      }
      const { error } = await supabase.from('recycler_ratings').insert({
        recycler_id: recyclerId,
        rater_id: profileId, // Debe ser el id interno de profiles
        rating: myRating,
        comment: myComment,
        created_at: new Date().toISOString(),
      });
      if (error) {
        setError('Error al enviar la calificación: ' + error.message);
      } else {
        setSuccessMsg('¡Calificación enviada!');
        setAlreadyRated(true);
        setMyExistingRating({
                  id: '',
                  rater_id: userProfileId || userId || '', // Asegura que rater_id esté presente
                  rating: myRating,
                  comment: myComment,
                  created_at: new Date().toISOString(),
                  resident: { name: 'Tú', avatar_url: user?.avatar_url },
                });
        setMyRating(0);
        setMyComment('');
      }
    } catch {
      setError('Error inesperado al enviar la calificación.');
    }
    setSubmitting(false);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 shadow-lg max-w-md w-full flex flex-col items-center relative">
        <button className="absolute top-2 right-2 text-gray-400 hover:text-gray-600 text-2xl font-bold" onClick={onClose} aria-label="Cerrar modal">×</button>
        <div className="w-20 h-20 rounded-full overflow-hidden mb-2 flex items-center justify-center bg-gray-200 border-2 border-green-600">
          {avatarUrl ? (
            <img src={avatarUrl} alt="Foto de perfil" className="w-full h-full object-cover" />
          ) : (
            <span className="text-4xl text-gray-400">👤</span>
          )}
        </div>
        <h2 className="text-xl font-bold text-green-700 mb-1">{recyclerName}</h2>
        {average !== null && (
          <div className="flex items-center mb-2">
            <Star className="h-5 w-5 text-yellow-400 mr-1" />
            <span className="font-medium text-lg">{average.toFixed(1)}</span>
            <span className="ml-2 text-gray-400 text-sm">({ratings.length})</span>
          </div>
        )}
        {/* Bloque para calificar si no ha calificado */}
        {!alreadyRated && userId && (
          <form className="w-full mb-4" onSubmit={handleSubmit}>
            <div className="flex items-center justify-center mb-2">
              {[1,2,3,4,5].map(star => (
                <button
                  type="button"
                  key={star}
                  onClick={() => setMyRating(star)}
                  className="focus:outline-none"
                  aria-label={`Calificar ${star} estrellas`}
                >
                  <Star
                    className={`h-8 w-8 ${myRating >= star ? 'text-yellow-400' : 'text-gray-300'}`}
                    fill={myRating >= star ? '#facc15' : 'none'}
                  />
                </button>
              ))}
            </div>
            <textarea
              className="w-full border rounded-md p-2 mb-2 focus:ring-2 focus:ring-green-400 focus:outline-none resize-none"
              rows={3}
              placeholder="Escribe un comentario (opcional)"
              value={myComment}
              onChange={e => setMyComment(e.target.value)}
              maxLength={300}
            />
            <button
              type="submit"
              className="w-full bg-green-600 text-white rounded-md py-2 font-semibold hover:bg-green-700 transition-all disabled:opacity-60"
              disabled={submitting}
            >
              {submitting ? 'Enviando...' : 'Enviar calificación'}
            </button>
            {error && <div className="text-red-600 text-sm mt-1">{error}</div>}
            {successMsg && <div className="text-green-600 text-sm mt-1">{successMsg}</div>}
          </form>
        )}
        {/* Si ya calificó, mostrar su calificación */}
        {alreadyRated && myExistingRating && (
          <div className="w-full mb-4 bg-green-50 border border-green-200 rounded p-3 flex flex-col items-center">
            <div className="flex items-center mb-1">
              {[1,2,3,4,5].map(star => (
                <Star
                  key={star}
                  className={`h-6 w-6 ${myExistingRating.rating >= star ? 'text-yellow-400' : 'text-gray-300'}`}
                  fill={myExistingRating.rating >= star ? '#facc15' : 'none'}
                />
              ))}
            </div>
            <div className="text-gray-700 text-sm text-center">{myExistingRating.comment || <span className="italic text-gray-400">Sin comentario</span>}</div>
            <div className="text-xs text-gray-400 mt-1">Tu calificación</div>
          </div>
        )}
        <div className="w-full mt-2 max-h-72 overflow-y-auto">
          {loading ? (
            <p className="text-gray-500 text-center">Cargando calificaciones...</p>
          ) : error ? (
            <p className="text-red-600 text-center">{error}</p>
          ) : ratings.length === 0 ? (
            <p className="text-gray-500 text-center">Aún no hay calificaciones.</p>
          ) : (
            <ul className="space-y-4">
              {ratings.map(r => (
                <li key={r.id} className="border-b pb-2">
                  <div className="flex items-center gap-2 mb-1">
                    <div className="w-8 h-8 rounded-full overflow-hidden bg-gray-100 flex items-center justify-center">
                      {r.resident?.avatar_url ? (
                        <img src={r.resident.avatar_url} alt="Residente" className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-lg text-gray-400">👤</span>
                      )}
                    </div>
                    <span className="font-semibold text-green-700 text-sm">{r.resident?.name || 'Residente'}</span>
                    <span className="flex items-center ml-2 text-yellow-500 text-sm">
                      {[...Array(r.rating)].map((_, i) => <Star key={i} className="h-4 w-4" fill="#facc15" />)}
                    </span>
                  </div>
                  <div className="text-gray-700 text-sm mb-1">{r.comment || <span className="italic text-gray-400">Sin comentario</span>}</div>
                  <div className="text-xs text-gray-400">{new Date(r.created_at).toLocaleString()}</div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
};

export default RecyclerRatingsModal;
