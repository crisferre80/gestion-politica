import React from 'react';
import { Link } from 'react-router-dom';
import { Calendar, Mail, Phone, MapPin, Star, ArrowLeft } from 'lucide-react';
import { createNotification } from '../lib/notifications';

// Mock data for recycler profile
const mockRecycler = {
  id: '1',
  name: 'Juan Pérez',
  email: 'juan@example.com',
  phone: '+123 456 7890',
  address: 'Zona Norte, Ciudad Verde',
  materials: ['Papel', 'Cartón', 'Plástico', 'Vidrio'],
  schedule: 'Lunes a Viernes, 8:00 - 18:00',
  bio: 'Soy reciclador desde hace 10 años, comprometido con el medio ambiente y la economía circular. Trabajo principalmente en la zona norte de la ciudad, recolectando diversos materiales reciclables.',
  rating: 4.8,
  reviews: [
    {
      id: '1',
      author: 'María López',
      date: '2025-04-15',
      rating: 5,
      comment: 'Excelente servicio, muy puntual y profesional.',
    },
    {
      id: '2',
      author: 'Carlos Rodríguez',
      date: '2025-03-22',
      rating: 4,
      comment: 'Muy buen trabajo, siempre cumple con los horarios acordados.',
    },
  ],
};

const RecyclerProfile: React.FC = () => {
  // In a real app, you would fetch the recycler data based on the ID
  const recycler = mockRecycler;

  // Estado para la reseña
  const [reviewRating, setReviewRating] = React.useState(0);
  const [reviewComment, setReviewComment] = React.useState('');
  const [reviewLoading, setReviewLoading] = React.useState(false);
  const [reviewSuccess, setReviewSuccess] = React.useState('');
  const [reviewError, setReviewError] = React.useState('');

  // Manejar envío de reseña
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
      // Aquí deberías guardar la reseña en la base de datos (tabla recycler_ratings)
      // Simulación: await supabase.from('recycler_ratings').insert(...)
      // Notificación para el reciclador
      await createNotification({
        user_id: mockRecycler.id, // En real: el id del reciclador
        title: 'Nueva calificación',
        content: 'Has recibido una nueva calificación de un residente.',
        type: 'recycler_rated',
        related_id: mockRecycler.id
      });
      setReviewSuccess('¡Reseña enviada correctamente!');
      setReviewRating(0);
      setReviewComment('');
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (err) {
      setReviewError('Error al enviar la reseña.');
    } finally {
      setReviewLoading(false);
    }
  };

  return (
    <div className="bg-gray-50 min-h-screen py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <Link to="/dashboard" className="flex items-center text-green-600 hover:text-green-700 mb-6">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Volver al panel
        </Link>
        
        <div className="bg-white shadow rounded-lg overflow-hidden">
          {/* Profile Header */}
          <div className="bg-green-600 text-white p-6">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between">
              <div>
                <h1 className="text-2xl font-bold">{recycler.name}</h1>
                <div className="flex items-center mt-2">
                  <Star className="h-5 w-5 text-yellow-300 mr-1" />
                  <span className="font-medium">{recycler.rating}</span>
                  <span className="mx-2 text-green-200">•</span>
                  <span>{recycler.reviews.length} reseñas</span>
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
                  <li className="flex items-start">
                    <Mail className="h-5 w-5 text-green-500 mr-3 mt-0.5" />
                    <span>{recycler.email}</span>
                  </li>
                  <li className="flex items-start">
                    <Phone className="h-5 w-5 text-green-500 mr-3 mt-0.5" />
                    <span>{recycler.phone}</span>
                  </li>
                  <li className="flex items-start">
                    <MapPin className="h-5 w-5 text-green-500 mr-3 mt-0.5" />
                    <span>{recycler.address}</span>
                  </li>
                  <li className="flex items-start">
                    <Calendar className="h-5 w-5 text-green-500 mr-3 mt-0.5" />
                    <span>{recycler.schedule}</span>
                  </li>
                </ul>

                <h2 className="text-lg font-semibold text-gray-900 mt-6 mb-4">Materiales que Recolecta</h2>
                <div className="flex flex-wrap gap-2">
                  {recycler.materials.map((material, index) => (
                    <span 
                      key={index}
                      className="bg-green-100 text-green-800 px-3 py-1 rounded-full text-sm"
                    >
                      {material}
                    </span>
                  ))}
                </div>
              </div>

              {/* Right Column - Bio and Reviews */}
              <div className="md:col-span-2">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Acerca de</h2>
                <p className="text-gray-600 mb-8">{recycler.bio}</p>

                <h2 className="text-lg font-semibold text-gray-900 mb-4">Reseñas</h2>
                {recycler.reviews.length > 0 ? (
                  <div className="space-y-6">
                    {recycler.reviews.map((review) => (
                      <div key={review.id} className="border-b border-gray-200 pb-6 last:border-b-0">
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="font-medium text-gray-900">{review.author}</p>
                            <p className="text-sm text-gray-500">
                              {new Date(review.date).toLocaleDateString()}
                            </p>
                          </div>
                          <div className="flex items-center">
                            {[...Array(5)].map((_, i) => (
                              <Star
                                key={i}
                                className={`h-4 w-4 ${
                                  i < review.rating ? 'text-yellow-400' : 'text-gray-300'
                                }`}
                                fill="currentColor"
                              />
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
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Calificación
                      </label>
                      <div className="flex">
                        {[1, 2, 3, 4, 5].map((rating) => (
                          <button
                            key={rating}
                            type="button"
                            className={"" + (reviewRating >= rating ? 'text-yellow-400' : 'text-gray-300')}
                            onClick={() => setReviewRating(rating)}
                          >
                            <Star className="h-6 w-6" />
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="mb-4">
                      <label htmlFor="comment" className="block text-sm font-medium text-gray-700 mb-2">
                        Comentario
                      </label>
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
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RecyclerProfile;