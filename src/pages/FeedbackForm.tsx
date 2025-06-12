import React, { useState } from 'react';
import { supabase } from '../lib/supabase';

const FeedbackForm: React.FC = () => {
  const [type, setType] = useState<'reclamo' | 'sugerencia'>('reclamo');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess(false);
    const { error } = await supabase.from('feedback').insert({
      type,
      name,
      email,
      message,
    });
    setLoading(false);
    if (error) {
      setError('Ocurrió un error al enviar el formulario.');
    } else {
      setSuccess(true);
      setName('');
      setEmail('');
      setMessage('');
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-green-50 py-8 px-4">
      <div className="bg-white shadow-lg rounded-lg p-8 w-full max-w-md">
        <h2 className="text-2xl font-bold mb-4 text-green-700 text-center">Reclamos y Sugerencias</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-gray-700 font-semibold mb-1">Tipo</label>
            <select
              value={type}
              onChange={e => setType(e.target.value as 'reclamo' | 'sugerencia')}
              className="w-full border rounded px-3 py-2"
            >
              <option value="reclamo">Reclamo</option>
              <option value="sugerencia">Sugerencia</option>
            </select>
          </div>
          <div>
            <label className="block text-gray-700 font-semibold mb-1">Nombre</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              className="w-full border rounded px-3 py-2"
              required
            />
          </div>
          <div>
            <label className="block text-gray-700 font-semibold mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="w-full border rounded px-3 py-2"
              required
            />
          </div>
          <div>
            <label className="block text-gray-700 font-semibold mb-1">Mensaje</label>
            <textarea
              value={message}
              onChange={e => setMessage(e.target.value)}
              className="w-full border rounded px-3 py-2"
              rows={4}
              required
            />
          </div>
          {error && <div className="text-red-600 text-sm">{error}</div>}
          {success && <div className="text-green-600 text-sm">¡Tu mensaje fue enviado correctamente!</div>}
          <button
            type="submit"
            className="w-full bg-green-600 text-white font-bold py-2 rounded hover:bg-green-700 transition"
            disabled={loading}
          >
            {loading ? 'Enviando...' : 'Enviar'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default FeedbackForm;
