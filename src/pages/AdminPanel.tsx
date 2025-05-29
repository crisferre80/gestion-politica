import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { createNotification } from '../lib/notifications';
import AdminAds from './AdminAds';

interface UserRow {
  id: string;
  name?: string;
  email?: string;
  role?: string;
  type?: string;
}

const AdminPanel: React.FC = () => {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedUser, setSelectedUser] = useState<UserRow | null>(null);
  const [notifTitle, setNotifTitle] = useState('');
  const [notifMsg, setNotifMsg] = useState('');
  const [notifTarget, setNotifTarget] = useState<'global' | 'individual'>('global');
  const [notifStatus, setNotifStatus] = useState('');
  const [stats, setStats] = useState<{[role: string]: number}>({});

  useEffect(() => {
    const fetchUsers = async () => {
      setLoading(true);
      const { data, error } = await supabase.from('profiles').select('id, name, email, role');
      if (!error && data) {
        setUsers(data);
        // Estadísticas por rol
        const stats: {[role: string]: number} = {};
        data.forEach((u: UserRow) => {
          const role = u.role || 'sin rol';
          stats[role] = (stats[role] || 0) + 1;
        });
        setStats(stats);
        // Si el usuario seleccionado ya no existe, deseleccionarlo
        if (selectedUser && !data.find(u => u.id === selectedUser.id)) {
          setSelectedUser(null);
        }
      } else {
        setError('Error al cargar usuarios');
      }
      setLoading(false);
    };
    fetchUsers();
    // Refrescar usuarios cada vez que se envía/elimina uno
  }, []);

  // Refrescar usuarios después de enviar notificación global o eliminar usuario
  const refreshUsers = async () => {
    setLoading(true);
    const { data, error } = await supabase.from('profiles').select('id, name, email, role');
    if (!error && data) {
      setUsers(data);
      const stats: {[role: string]: number} = {};
      data.forEach((u: UserRow) => {
        const role = u.role || 'sin rol';
        stats[role] = (stats[role] || 0) + 1;
      });
      setStats(stats);
      if (selectedUser && !data.find(u => u.id === selectedUser.id)) {
        setSelectedUser(null);
      }
    } else {
      setError('Error al cargar usuarios');
    }
    setLoading(false);
  };

  const handleDeleteUser = async (userId: string) => {
    if (!window.confirm('¿Seguro que deseas eliminar este usuario?')) return;
    await supabase.from('profiles').delete().eq('id', userId);
    await refreshUsers();
  };

  const handleSendNotification = async (e: React.FormEvent) => {
    e.preventDefault();
    setNotifStatus('');
    try {
      if (notifTarget === 'global') {
        // Notificación global a todos SOLO a usuarios válidos en el estado
        for (const u of users) {
          if (!u.id) continue;
          console.log('[NOTIF] Intentando enviar notificación global', {
            user_id: u.id,
            notifTitle,
            notifMsg,
            type: 'admin',
            fecha: new Date().toISOString(),
            existeEnProfiles: true // porque users viene de profiles
          });
          try {
            await createNotification({
              user_id: u.id,
              title: notifTitle,
              content: notifMsg,
              type: 'admin',
            });
          } catch (err) {
            console.error('[NOTIF][ERROR] Falló envío a', u.id, err);
          }
        }
        setNotifStatus('Notificación global enviada');
        await refreshUsers();
      } else if (selectedUser) {
        // Verifica que el usuario seleccionado existe en el estado
        const validUser = users.find(u => u.id === selectedUser.id);
        if (!validUser) {
          setNotifStatus('El usuario seleccionado ya no existe.');
          setSelectedUser(null);
          return;
        }
        console.log('[NOTIF] Intentando enviar notificación individual', {
          user_id: selectedUser.id,
          notifTitle,
          notifMsg,
          type: 'admin',
          fecha: new Date().toISOString(),
          existeEnProfiles: true
        });
        try {
          await createNotification({
            user_id: selectedUser.id,
            title: notifTitle,
            content: notifMsg,
            type: 'admin',
          });
          setNotifStatus('Notificación enviada al usuario');
        } catch (err) {
          setNotifStatus('Error al enviar la notificación');
          console.error('[NOTIF][ERROR] Falló envío individual a', selectedUser.id, err);
        }
      }
    } catch (err) {
      setNotifStatus('Error al enviar notificaciones');
      console.error('[NOTIF][ERROR] Error global al enviar notificaciones:', err);
    }
    setNotifTitle('');
    setNotifMsg('');
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <h1 className="text-3xl font-bold text-green-700 mb-6">Panel de Administrador</h1>
      <div className="mb-8">
        <h2 className="text-xl font-semibold mb-2">Estadísticas de usuarios</h2>
        <ul className="flex gap-6">
          {Object.entries(stats).map(([role, count]) => (
            <li key={role} className="bg-white rounded shadow px-4 py-2">
              <span className="font-bold text-green-700">{role}</span>: {count}
            </li>
          ))}
        </ul>
      </div>
      <div className="mb-8">
        <h2 className="text-xl font-semibold mb-2">Usuarios registrados</h2>
        {loading ? <p>Cargando...</p> : error ? <p className="text-red-600">{error}</p> : (
          <table className="w-full bg-white rounded shadow">
            <thead>
              <tr className="bg-green-100">
                <th className="p-2">Nombre</th>
                <th className="p-2">Email</th>
                <th className="p-2">Rol</th>
                <th className="p-2">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id} className="border-b">
                  <td className="p-2">{u.name}</td>
                  <td className="p-2">{u.email}</td>
                  <td className="p-2 capitalize">{u.role}</td>
                  <td className="p-2 flex gap-2">
                    <button className="bg-red-500 text-white px-2 py-1 rounded" onClick={() => handleDeleteUser(u.id)}>Eliminar</button>
                    <button className="bg-blue-500 text-white px-2 py-1 rounded" onClick={() => { setNotifTarget('individual'); setSelectedUser(u); }}>Notificar</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <div className="mb-8">
        <h2 className="text-xl font-semibold mb-2">Enviar notificación</h2>
        <form onSubmit={handleSendNotification} className="flex flex-col gap-2 max-w-md">
          <label className="flex gap-2 items-center">
            <input type="radio" checked={notifTarget==='global'} onChange={() => setNotifTarget('global')} /> Global
          </label>
          <label className="flex gap-2 items-center">
            <input type="radio" checked={notifTarget==='individual'} onChange={() => setNotifTarget('individual')} /> Individual
            {notifTarget==='individual' && selectedUser && (
              <span className="ml-2 text-green-700">{selectedUser.email}</span>
            )}
          </label>
          <input className="border rounded px-2 py-1" placeholder="Título" value={notifTitle} onChange={e => setNotifTitle(e.target.value)} required />
          <textarea className="border rounded px-2 py-1" placeholder="Mensaje" value={notifMsg} onChange={e => setNotifMsg(e.target.value)} required />
          <button className="bg-green-600 text-white px-4 py-2 rounded mt-2" type="submit">Enviar notificación</button>
          {notifStatus && <p className="text-green-700 mt-2">{notifStatus}</p>}
        </form>
      </div>
      <div className="mb-12">
        <AdminAds />
      </div>
    </div>
  );
};

export default AdminPanel;
