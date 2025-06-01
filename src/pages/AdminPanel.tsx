import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { createNotification } from '../lib/notifications';
import AdminAds from './AdminAds';

interface UserRow {
  id: string;
  user_id: string; // <-- Agregado para notificaciones
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
  const [roleFilter, setRoleFilter] = useState<string>('');

  useEffect(() => {
    const fetchUsers = async () => {
      setLoading(true);
      const { data, error } = await supabase.from('profiles').select('id, user_id, name, email, role');
      if (!error && data) {
        console.log('[ADMIN][USERS]', data); // <-- Log temporal para depuración
        setUsers(data);
        // Estadísticas por rol
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
    fetchUsers();
  }, [selectedUser]);

  // Refrescar usuarios después de enviar notificación global o eliminar usuario
  const refreshUsers = async () => {
    setLoading(true);
    const { data, error } = await supabase.from('profiles').select('id, user_id, name, email, role');
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
          if (!u.user_id) continue; // Usar user_id (UUID)
          try {
            await createNotification({
              user_id: u.user_id,
              title: notifTitle,
              content: notifMsg,
              type: 'admin',
            });
          } catch (err) {
            console.error('[NOTIF][ERROR] Falló envío a', u.user_id, err);
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
        try {
          await createNotification({
            user_id: validUser.user_id, // Usar user_id (UUID)
            title: notifTitle,
            content: notifMsg,
            type: 'admin',
          });
          setNotifStatus('Notificación enviada al usuario');
        } catch (err) {
          setNotifStatus('Error al enviar la notificación');
          console.error('[NOTIF][ERROR] Falló envío individual a', validUser.user_id, err);
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
        <div className="mb-2">
          <label className="mr-2">Filtrar por rol:</label>
          <select className="border rounded px-2 py-1" value={roleFilter} onChange={e => setRoleFilter(e.target.value)}>
            <option value="">Todos</option>
            <option value="admin">Admin</option>
            <option value="recycler">Reciclador</option>
            <option value="resident">Residente</option>
          </select>
        </div>
        <div className="overflow-x-auto w-full rounded-lg shadow-sm bg-white/80 border border-gray-200">
          {loading ? <p className="p-4">Cargando...</p> : error ? <p className="text-red-600 p-4">{error}</p> : (
            <table className="min-w-[600px] w-full text-sm md:text-base">
              <thead className="sticky top-0 bg-green-100 z-10">
                <tr>
                  <th className="p-2 font-semibold text-gray-700 whitespace-nowrap">Nombre</th>
                  <th className="p-2 font-semibold text-gray-700 whitespace-nowrap">Email</th>
                  <th className="p-2 font-semibold text-gray-700 whitespace-nowrap">Rol</th>
                  <th className="p-2 font-semibold text-gray-700 whitespace-nowrap">User ID</th>
                  <th className="p-2 font-semibold text-gray-700 whitespace-nowrap">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {users.filter(u => !roleFilter || u.role === roleFilter).length === 0 ? (
                  <tr><td colSpan={5} className="text-center text-gray-500 p-4">No hay usuarios para mostrar.</td></tr>
                ) : (
                  users.filter(u => !roleFilter || u.role === roleFilter).map(u => (
                    <tr key={u.id} className="border-b hover:bg-green-50 transition-colors">
                      <td className="p-2 whitespace-nowrap">{u.name}</td>
                      <td className="p-2 whitespace-nowrap">{u.email}</td>
                      <td className="p-2 capitalize whitespace-nowrap">{u.role}</td>
                      <td className="p-2 text-xs font-mono break-all max-w-[120px] whitespace-pre-line">{u.user_id}</td>
                      <td className="p-2 flex flex-col md:flex-row gap-2 items-start md:items-center">
                        <button className="bg-red-500 hover:bg-red-600 text-white px-3 py-2 rounded text-xs md:text-sm w-full md:w-auto" onClick={() => handleDeleteUser(u.id)}>Eliminar</button>
                        {u.user_id && (
                          <button className="bg-blue-500 hover:bg-blue-600 text-white px-3 py-2 rounded text-xs md:text-sm w-full md:w-auto" onClick={() => { setNotifTarget('individual'); setSelectedUser(u); }}>Notificar</button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}
        </div>
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
