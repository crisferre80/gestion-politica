import React, { useState } from 'react';
import { supabase } from '../lib/supabase';

const AdminNotifications: React.FC = () => {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [icon, setIcon] = useState('🔔');
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus('');
    setLoading(true);
    // Obtener todos los usuarios
    const { data: users, error } = await supabase.from('profiles').select('user_id');
    if (error) {
      setStatus('Error al obtener usuarios.');
      setLoading(false);
      return;
    }
    // Insertar una notificación para cada usuario
    const notifications = users.map((user: { user_id: string }) => ({
      user_id: user.user_id,
      title,
      content,
      icon,
      from: 'EcoNecta2',
      read: false,
      created_at: new Date().toISOString(),
    }));
    const { error: insertError } = await supabase.from('notifications').insert(notifications);
    if (insertError) {
      setStatus('❌ Error al enviar la notificación.');
    } else {
      setStatus('✅ Notificación enviada a todos los usuarios.');
      setTitle('');
      setContent('');
    }
    setLoading(false);
  };

  return (
    <div className="admin-notifications-section bg-green-50 border-2 border-green-400 rounded-xl p-6 my-6 shadow-lg">
      <h2 className="text-xl font-bold text-green-800 mb-4">Administrador: Enviar Notificación Global</h2>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div>
          <label className="block font-semibold mb-1">Título:</label>
          <input value={title} onChange={e => setTitle(e.target.value)} required className="w-full border rounded px-2 py-1" />
        </div>
        <div>
          <label className="block font-semibold mb-1">Mensaje:</label>
          <textarea value={content} onChange={e => setContent(e.target.value)} required className="w-full border rounded px-2 py-1" />
        </div>
        <div>
          <label className="block font-semibold mb-1">Icono:</label>
          <input value={icon} onChange={e => setIcon(e.target.value)} maxLength={2} className="w-16 border rounded px-2 py-1 text-2xl" />
        </div>
        <button type="submit" disabled={loading} className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 font-semibold">
          {loading ? 'Enviando...' : 'Enviar'}
        </button>
      </form>
      {status && <p className="mt-4 font-semibold text-green-700">{status}</p>}
    </div>
  );
};

export default AdminNotifications;
