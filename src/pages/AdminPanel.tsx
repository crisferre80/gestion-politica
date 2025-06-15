import React, { useEffect, useState, useRef } from 'react';
import { deleteCollectionPoint, supabase, CollectionPoint } from '../lib/supabase';
import { createNotification } from '../lib/notifications';
import AdminAds from './AdminAds';
import { useZones } from '../hooks/useZones';
import MapComponent, { Zone } from '../components/Map';

interface UserRow {
  avatar_url: string | null;
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
  const [notifTarget, setNotifTarget] = useState<'global' | 'individual' | 'residentes' | 'recicladores'>('global');
  const [notifStatus, setNotifStatus] = useState('');
  const [stats, setStats] = useState<{[role: string]: number}>({});
  const [roleFilter, setRoleFilter] = useState<string>('');
  const [showPointsModal, setShowPointsModal] = useState(false);
  const [points, setPoints] = useState<CollectionPoint[]>([]);
  const [pointsLoading, setPointsLoading] = useState(false);
  const [pointsError, setPointsError] = useState<string|null>(null);
  const [assigningPointId, setAssigningPointId] = useState<string|null>(null);
  const [recyclers, setRecyclers] = useState<UserRow[]>([]);
  // Nuevo: Mapa de conteo de puntos por usuario
  const [userPointsCount, setUserPointsCount] = useState<Record<string, number>>({});
  // Tipado para feedback
  interface Feedback {
    id: string;
    type: string;
    name: string;
    email: string;
    message: string;
    created_at: string;
  }
  const [feedbacks, setFeedbacks] = useState<Feedback[]>([]);
  const [feedbackLoading, setFeedbackLoading] = useState(false);
  const [feedbackError, setFeedbackError] = useState<string|null>(null);
  const [activeTab, setActiveTab] = useState<'usuarios' | 'notificaciones' | 'feedback' | 'publicidades'>('usuarios');
  // Zonas para el mapa admin
  const { zones, loading: zonesLoading, handleDelete, reloadZones } = useZones();
  const [showZonesModal, setShowZonesModal] = useState(false);
  const [pendingZone, setPendingZone] = useState<Omit<Zone, 'id'> | null>(null);
  const [pendingZoneName, setPendingZoneName] = useState('');
  const [pendingZoneColor, setPendingZoneColor] = useState('#3b82f6');

  // Ref para el mapa admin, ahora incluye setDrawMode y clearDraw
  const mapComponentRef = useRef<{
    clearDraw: (mode?: 'draw_polygon' | 'edit_polygon') => void;
    setDrawMode: (mode: 'draw_polygon' | 'edit_polygon' | 'none') => void;
  }>(null);
  const [isDrawingZone, setIsDrawingZone] = useState(false);

  useEffect(() => {
    const fetchUsersAndPoints = async () => {
      setLoading(true);
      const { data: usersData, error: usersError } = await supabase.from('profiles').select('id, user_id, name, email, role, avatar_url');
      if (!usersError && usersData) {
        setUsers(usersData);
        // Estadísticas por rol
        const stats: {[role: string]: number} = {};
        usersData.forEach((u: UserRow) => {
          const role = u.role || 'sin rol';
          stats[role] = (stats[role] || 0) + 1;
        });
        setStats(stats);
        // Cargar conteo de puntos de recolección por usuario SOLO puntos activos
        const { data: pointsAgg } = await supabase
          .from('collection_points')
          .select('user_id')
          .in('status', ['available', 'claimed']) // Solo puntos activos
          .not('user_id', 'is', null);
        const pointsCount: Record<string, number> = {};
        if (pointsAgg) {
          pointsAgg.forEach((row: { user_id: string }) => {
            if (row.user_id) {
              pointsCount[row.user_id] = (pointsCount[row.user_id] || 0) + 1;
            }
          });
        }
        setUserPointsCount(pointsCount);
        if (selectedUser && !usersData.find(u => u.id === selectedUser.id)) {
          setSelectedUser(null);
        }
      } else {
        setError('Error al cargar usuarios');
      }
      setLoading(false);
    };
    fetchUsersAndPoints();
  }, [selectedUser]);

  // Refrescar usuarios después de enviar notificación global o eliminar usuario
  const refreshUsers = async () => {
    setLoading(true);
    const { data, error } = await supabase.from('profiles').select('id, user_id, name, email, role, avatar_url');
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
              user_name: u.name,
              user_email: u.email
            });
          } catch (err) {
            console.error('[NOTIF][ERROR] Falló envío a', u.user_id, err);
          }
        }
        setNotifStatus('Notificación global enviada');
        await refreshUsers();
      } else if (notifTarget === 'residentes') {
        for (const u of users) {
          if (u.role !== 'resident' || !u.user_id) continue;
          try {
            await createNotification({
              user_id: u.user_id,
              title: notifTitle,
              content: notifMsg,
              type: 'admin',
              user_name: u.name,
              user_email: u.email
            });
          } catch (err) {
            console.error('[NOTIF][ERROR] Falló envío a residente', u.user_id, err);
          }
        }
        setNotifStatus('Notificación enviada a todos los residentes');
      } else if (notifTarget === 'recicladores') {
        for (const u of users) {
          if (u.role !== 'recycler' || !u.user_id) continue;
          try {
            await createNotification({
              user_id: u.user_id,
              title: notifTitle,
              content: notifMsg,
              type: 'admin',
              user_name: u.name,
              user_email: u.email
            });
          } catch (err) {
            console.error('[NOTIF][ERROR] Falló envío a reciclador', u.user_id, err);
          }
        }
        setNotifStatus('Notificación enviada a todos los recicladores');
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
            user_name: validUser.name,
            user_email: validUser.email
          });
          setNotifStatus('Notificación enviada al usuario');
        } catch (err) {
          setNotifStatus('El usuario fue notificado, pero no se pudo registrar la notificación en la base de datos.');
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

  // Cargar recicladores para asignación
  useEffect(() => {
    const fetchRecyclers = async () => {
      const { data } = await supabase.from('profiles').select('id, user_id, name, email, role, avatar_url').eq('role', 'recycler');
      if (data) setRecyclers(data as UserRow[]);
    };
    fetchRecyclers();
  }, []);

  // Mostrar puntos de recolección de un usuario
  const handleShowPoints = async (user: UserRow) => {
    setSelectedUser(user);
    setShowPointsModal(true);
    setPointsLoading(true);
    setPointsError(null);
    const { data, error } = await supabase.from('collection_points').select('*').eq('user_id', user.user_id);
    if (error) setPointsError('Error al cargar puntos');
    setPoints(data || []);
    setPointsLoading(false);
  };

  // Eliminar punto de recolección
  const handleDeletePoint = async (pointId: string) => {
    if (!selectedUser) return;
    if (!window.confirm('¿Eliminar este punto de recolección?')) return;
    try {
      await deleteCollectionPoint(pointId, selectedUser.user_id);
      setPoints(points.filter(p => p.id !== pointId));
    } catch {
      alert('Error al eliminar el punto');
    }
  };

  // Asignar punto a reciclador
  const handleAssignRecycler = async (pointId: string, recyclerId: string) => {
    setAssigningPointId(pointId);
    const { error } = await supabase.from('collection_points').update({ recycler_id: recyclerId, status: 'claimed' }).eq('id', pointId);
    setAssigningPointId(null);
    if (error) {
      alert('Error al asignar reciclador');
    } else {
      setPoints(points.map(p => p.id === pointId ? { ...p, recycler_id: recyclerId, status: 'claimed' } : p));
    }
  };

  // Cargar sugerencias y reclamos
  useEffect(() => {
    const fetchFeedbacks = async () => {
      setFeedbackLoading(true);
      setFeedbackError(null);
      const { data, error } = await supabase.from('feedback').select('*').order('created_at', { ascending: false });
      if (error) setFeedbackError('Error al cargar feedback');
      setFeedbacks(data || []);
      setFeedbackLoading(false);
    };
    fetchFeedbacks();
  }, []);

  const handleCloseZonesModal = () => {
    setShowZonesModal(false);
    if (mapComponentRef.current) {
      mapComponentRef.current.clearDraw();
    }
    setPendingZone(null);
    setPendingZoneName('');
    setPendingZoneColor('#3b82f6');
  };

  // Agrupar zonas por nombre
  const groupedZones = Object.values(zones.reduce((acc, z) => {
    // Adaptar coordinates: si es string, parsear a array
    let coordinates = z.coordinates;
    if (typeof coordinates === 'string') {
      try {
        coordinates = JSON.parse(coordinates);
      } catch (e) {
        console.error('Error al parsear coordinates de zona', z, e);
        coordinates = [];
      }
    }
    if (!acc[z.name]) {
      acc[z.name] = { ...z, color: z.color ?? '#3b82f6', ids: [z.id], coordinates: [coordinates] };
    } else {
      acc[z.name].ids.push(z.id);
      acc[z.name].coordinates.push(coordinates);
    }
    return acc;
  }, {} as Record<string, { 
    id: string; 
    name: string; 
    color: string; 
    coordinates: number[][][]; 
    ids: string[]; 
    // coordinates is now an array of arrays for grouping
  }>));

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <h1 className="text-3xl font-bold text-green-700 mb-6">Panel de Administrador</h1>
      <div className="mb-8">
        <div className="flex gap-4 mb-6">
          <button onClick={() => setActiveTab('usuarios')} className={`px-4 py-2 rounded-t-lg font-semibold border-b-2 ${activeTab === 'usuarios' ? 'border-green-600 text-green-700 bg-white' : 'border-transparent text-gray-500 bg-green-100 hover:bg-white'}`}>Usuarios Registrados</button>
          <button onClick={() => setActiveTab('notificaciones')} className={`px-4 py-2 rounded-t-lg font-semibold border-b-2 ${activeTab === 'notificaciones' ? 'border-green-600 text-green-700 bg-white' : 'border-transparent text-gray-500 bg-green-100 hover:bg-white'}`}>Enviar Notificaciones</button>
          <button onClick={() => setActiveTab('feedback')} className={`px-4 py-2 rounded-t-lg font-semibold border-b-2 ${activeTab === 'feedback' ? 'border-green-600 text-green-700 bg-white' : 'border-transparent text-gray-500 bg-green-100 hover:bg-white'}`}>Sugerencias y Reclamos</button>
          <button onClick={() => setActiveTab('publicidades')} className={`px-4 py-2 rounded-t-lg font-semibold border-b-2 ${activeTab === 'publicidades' ? 'border-green-600 text-green-700 bg-white' : 'border-transparent text-gray-500 bg-green-100 hover:bg-white'}`}>Gestionar Publicidades</button>
          <button onClick={() => setShowZonesModal(true)} className="px-4 py-2 rounded-t-lg font-semibold border-b-2 border-transparent text-gray-500 bg-green-100 hover:bg-white">Zonas del Mapa</button>
        </div>
        {activeTab === 'usuarios' && (
          <>
            <h2 className="text-xl font-semibold mb-2">Estadísticas de usuarios</h2>
            <ul className="flex gap-6">
              {Object.entries(stats).map(([role, count]) => (
                <li key={role} className="bg-white rounded shadow px-4 py-2">
                  <span className="font-bold text-green-700">{role}</span>: {count}
                </li>
              ))}
            </ul>
            <h2 className="text-xl font-semibold mb-2 mt-8">Usuarios registrados</h2>
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
                      <th className="p-2 font-semibold text-gray-700 whitespace-nowrap">Avatar</th>
                      <th className="p-2 font-semibold text-gray-700 whitespace-nowrap">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.filter(u => !roleFilter || u.role === roleFilter).length === 0 ? (
                      <tr><td colSpan={6} className="text-center text-gray-500 p-4">No hay usuarios para mostrar.</td></tr>
                    ) : (
                      users.filter(u => !roleFilter || u.role === roleFilter).map(u => (
                        <tr key={u.id} className={`border-b hover:bg-green-50 transition-colors ${!u.user_id || !u.role ? 'bg-yellow-100' : ''}`}>
                          <td className="p-2 whitespace-nowrap">
                            {u.avatar_url ? (
                              <img src={u.avatar_url} alt="avatar" className="w-8 h-8 rounded-full object-cover border border-green-300 inline-block mr-2 align-middle" />
                            ) : (
                              <span className="inline-block w-8 h-8 rounded-full bg-gray-200 border border-green-100 mr-2 align-middle"></span>
                            )}
                            {u.name || <span className="text-red-600">Sin nombre</span>}
                          </td>
                          <td className="p-2 whitespace-nowrap">{u.email || <span className="text-red-600">Sin email</span>}</td>
                          <td className="p-2 capitalize whitespace-nowrap">{u.role || <span className="text-red-600">Sin rol</span>}</td>
                          <td className="p-2 max-w-[160px] whitespace-nowrap overflow-x-auto scrollbar-thin scrollbar-thumb-green-200 scrollbar-track-green-50" style={{ WebkitOverflowScrolling: 'touch' }}>
                            <div className="min-w-[120px] flex items-center">
                              {u.user_id || <span className="text-red-600">Sin user_id</span>}
                            </div>
                          </td>
                          <td className="p-2 flex flex-col md:flex-row gap-2 items-start md:items-center">
                            <button className="bg-red-500 hover:bg-red-600 text-white px-3 py-2 rounded text-xs md:text-sm w-full md:w-auto" onClick={() => handleDeleteUser(u.id)}>Eliminar</button>
                            {u.user_id && (
                              <button className="bg-blue-500 hover:bg-blue-600 text-white px-3 py-2 rounded text-xs md:text-sm w-full md:w-auto" onClick={() => { setNotifTarget('individual'); setSelectedUser(u); }}>Notificar</button>
                            )}
                            {u.user_id && (
                              <button className={`relative px-3 py-2 rounded text-xs md:text-sm w-full md:w-auto flex items-center justify-center font-semibold transition-colors
        ${userPointsCount && typeof userPointsCount[u.user_id] !== 'undefined' && userPointsCount[u.user_id] > 0
          ? 'bg-green-500 hover:bg-green-600 text-white border-2 border-green-700'
          : 'bg-gray-200 hover:bg-green-200 text-green-700'}`}
                                onClick={() => handleShowPoints(u)}
                              >
                                Ver puntos
                                {/* Marca visual: check verde si tiene puntos activos */}
                                {userPointsCount && typeof userPointsCount[u.user_id] !== 'undefined' && userPointsCount[u.user_id] > 0 && (
                                  <span className="ml-2 text-green-700 font-bold text-lg" title="Tiene puntos activos">✔</span>
                                )}
                                {/* También muestra la cantidad */}
                                {userPointsCount && typeof userPointsCount[u.user_id] !== 'undefined' && userPointsCount[u.user_id] > 0 && (
                                  <span className="ml-1 text-xs font-bold">({userPointsCount[u.user_id]})</span>
                                )}
                                {/* Acción realizada */}
                                {selectedUser && selectedUser.id === u.id && showPointsModal && (
                                  <span className="ml-2 text-xs text-blue-700 font-semibold">(Viendo puntos)</span>
                                )}
                              </button>
                            )}
                            {(!u.user_id || !u.role) && (
                              <span className="text-xs text-yellow-800 bg-yellow-200 rounded px-2 py-1 mt-1">Perfil incompleto</span>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              )}
            </div>
          </>
        )}
        {activeTab === 'notificaciones' && (
          <div className="mb-8">
            <h2 className="text-xl font-semibold mb-2">Enviar notificación</h2>
            <form onSubmit={handleSendNotification} className="flex flex-col gap-2 max-w-md">
              <div className="flex gap-4 mb-2">
                <label className="flex gap-2 items-center">
                  <input type="radio" checked={notifTarget==='global'} onChange={() => setNotifTarget('global')} /> Global
                </label>
                <label className="flex gap-2 items-center">
                  <input type="radio" checked={notifTarget==='residentes'} onChange={() => setNotifTarget('residentes')} /> Todos los residentes
                </label>
                <label className="flex gap-2 items-center">
                  <input type="radio" checked={notifTarget==='recicladores'} onChange={() => setNotifTarget('recicladores')} /> Todos los recicladores
                </label>
                <label className="flex gap-2 items-center">
                  <input type="radio" checked={notifTarget==='individual'} onChange={() => setNotifTarget('individual')} /> Individual
                  {notifTarget==='individual' && selectedUser && (
                    <span className="ml-2 text-green-700">{selectedUser.email}</span>
                  )}
                </label>
              </div>
              <input className="border rounded px-2 py-1" placeholder="Título" value={notifTitle} onChange={e => setNotifTitle(e.target.value)} required />
              <textarea className="border rounded px-2 py-1" placeholder="Mensaje" value={notifMsg} onChange={e => setNotifMsg(e.target.value)} required />
              <button className="bg-green-600 text-white px-4 py-2 rounded mt-2" type="submit">Enviar notificación</button>
              {notifStatus && <p className="text-green-700 mt-2">{notifStatus}</p>}
            </form>
          </div>
        )}
        {activeTab === 'feedback' && (
          <div className="mb-8">
            <h2 className="text-xl font-semibold mb-2">Sugerencias y Reclamos de Usuarios</h2>
            {feedbackLoading ? <p>Cargando...</p> : feedbackError ? <p className="text-red-600">{feedbackError}</p> : (
              <div className="overflow-x-auto w-full rounded-lg shadow-sm bg-white/80 border border-gray-200">
                <table className="min-w-[600px] w-full text-sm md:text-base">
                  <thead className="sticky top-0 bg-green-100 z-10">
                    <tr>
                      <th className="p-2 font-semibold text-gray-700 whitespace-nowrap">Tipo</th>
                      <th className="p-2 font-semibold text-gray-700 whitespace-nowrap">Nombre</th>
                      <th className="p-2 font-semibold text-gray-700 whitespace-nowrap">Email</th>
                      <th className="p-2 font-semibold text-gray-700 whitespace-nowrap">Mensaje</th>
                      <th className="p-2 font-semibold text-gray-700 whitespace-nowrap">Fecha</th>
                    </tr>
                  </thead>
                  <tbody>
                    {feedbacks.length === 0 ? (
                      <tr><td colSpan={5} className="text-center text-gray-500 p-4">No hay sugerencias ni reclamos.</td></tr>
                    ) : (
                      feedbacks.map(fb => (
                        <tr key={fb.id} className="border-b hover:bg-green-50 transition-colors">
                          <td className="p-2 whitespace-nowrap capitalize">{fb.type}</td>
                          <td className="p-2 whitespace-nowrap">{fb.name}</td>
                          <td className="p-2 whitespace-nowrap">{fb.email}</td>
                          <td className="p-2 whitespace-pre-line max-w-xs break-words">{fb.message}</td>
                          <td className="p-2 whitespace-nowrap">{new Date(fb.created_at).toLocaleString()}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
        {activeTab === 'publicidades' && (
          <div className="mb-12">
            <AdminAds />
          </div>
        )}
        {showZonesModal && (
          <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center">
            <div className="bg-white rounded-lg shadow-lg w-full max-w-lg sm:max-w-2xl md:max-w-3xl lg:max-w-4xl p-2 sm:p-4 md:p-6 max-h-[90vh] overflow-y-auto relative">
              <button className="absolute top-2 right-2 text-gray-500 hover:text-red-600" onClick={handleCloseZonesModal}>✕</button>
              <h3 className="text-lg font-bold mb-2">Gestión de Zonas del Mapa</h3>
              {/* Manejo de errores de zonas */}
              {error && (
                <div className="bg-red-100 text-red-700 p-2 rounded mb-2 font-semibold">Error: {error}</div>
              )}
              {zonesLoading ? <p>Cargando zonas...</p> : (
                <>
                  {/* LOG DE DEPURACIÓN */}
                  {console.log('zones', zones, 'pendingZone', pendingZone)}
                  {/* Fallback visual si no hay zonas o hay error */}
                  <div className="mb-4 flex flex-col md:flex-row gap-4 items-end">
                    <div className="flex-1">
                      <label className="block text-sm font-medium text-gray-700 mb-1">Nombre de la zona a crear:</label>
                      <input
                        type="text"
                        className="border rounded px-2 py-1 w-full"
                        placeholder="Ej: Zona Norte, Centro, etc."
                        value={pendingZoneName}
                        onChange={e => setPendingZoneName(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Color:</label>
                      <input
                        type="color"
                        className="w-10 h-10 p-0 border-0 bg-transparent"
                        value={pendingZoneColor}
                        onChange={e => setPendingZoneColor(e.target.value)}
                        title="Elige color de la zona"
                      />
                    </div>
                  </div>
                  <div className="mb-2 flex flex-wrap gap-2 items-center">
                    <span className="inline-block text-xs text-gray-600 bg-gray-100 rounded px-2 py-1 border border-gray-200 cursor-help" title="Puedes finalizar el dibujo de la zona haciendo doble clic o con el botón derecho del mouse">
                      ℹ️ Finaliza el dibujo con doble clic o botón derecho
                    </span>
                    {isDrawingZone ? (
                      <button
                        className="px-3 py-1 rounded bg-red-600 text-white font-semibold shadow hover:bg-red-700 transition"
                        onClick={() => {
                          setIsDrawingZone(false);
                          if (mapComponentRef.current && typeof mapComponentRef.current.clearDraw === 'function') {
                            mapComponentRef.current.clearDraw();
                          }
                        }}
                        type="button"
                      >
                        Cancelar
                      </button>
                    ) : (
                      <button
                        className="px-3 py-1 rounded bg-green-600 text-white font-semibold shadow hover:bg-green-700 transition"
                        onClick={() => {
                          setIsDrawingZone(true);
                          setPendingZone(null); // Limpiar zona pendiente
                          setPendingZoneName('');
                          setPendingZoneColor('#3b82f6');
                          if (mapComponentRef.current && typeof mapComponentRef.current.clearDraw === 'function') {
                            mapComponentRef.current.clearDraw();
                          }
                          if (mapComponentRef.current && typeof mapComponentRef.current.setDrawMode === 'function') {
                            mapComponentRef.current.setDrawMode('draw_polygon');
                          }
                        }}
                        type="button"
                      >
                        Crear Zona
                      </button>
                    )}
                    <button
                      className={`px-3 py-1 rounded bg-blue-600 text-white font-semibold shadow hover:bg-blue-700 transition disabled:opacity-50`}
                      onClick={() => {
                        if (
                          mapComponentRef.current &&
                          typeof mapComponentRef.current.setDrawMode === 'function'
                        ) {
                          mapComponentRef.current.setDrawMode('edit_polygon');
                        }
                      }}
                      type="button"
                    >
                      Editar Zona
                    </button>
                  </div>
                  <div style={{ height: '500px', width: '100%' }}>
                    <MapComponent
                      ref={mapComponentRef}
                      points={[]}
                      zones={zones.filter(z => {
                        console.log('DEBUG: zona', z.name, 'coordinates:', z.coordinates, 'tipo:', typeof z.coordinates, 'length:', Array.isArray(z.coordinates) ? z.coordinates.length : 'no-array');
                        return Array.isArray(z.coordinates) && z.coordinates.length >= 4;
                      })}
                      isAdmin={true}
                      onZoneCreate={zone => {
                        setPendingZone({ ...zone, color: pendingZoneColor, name: pendingZoneName });
                        // No limpiar pendingZone aquí, solo después de guardar
                      }}
                      pendingZone={pendingZone ? { ...pendingZone, color: pendingZoneColor, name: pendingZoneName, id: 'pending' } : null}
                    />
                  </div>
                  <div className="flex flex-col sm:flex-row justify-between mt-4 gap-2">
                    <button
                      className="bg-green-600 text-white px-4 py-2 rounded shadow disabled:opacity-50"
                      onClick={async () => {
                        if (pendingZone && pendingZoneName.trim() && (pendingZone.coordinates.length ?? 0) >= 4) {
                          const zoneData: Omit<Zone, 'id'> = { ...pendingZone };
                          try {
                            const { data: { user }, error: userError } = await supabase.auth.getUser();
                            if (userError) {
                              alert('Error de autenticación: ' + userError.message);
                              return;
                            }
                            if (!user) {
                              alert('Debes iniciar sesión para crear una zona.');
                              return;
                            }
                            // Validar name
                            if (!pendingZoneName.trim()) {
                              alert('El nombre de la zona es obligatorio.');
                              return;
                            }
                            // Validar coordinates
                            const coordinatesString = Array.isArray(zoneData.coordinates)
                              ? JSON.stringify(zoneData.coordinates)
                              : (typeof zoneData.coordinates === 'string'
                                  ? (zoneData.coordinates as string).replace(/^"|"$/g, '')
                                  : '[]');
                            console.log('DEBUG: Insertando zona con coordinates:', coordinatesString);
                            // Solo crear el objeto sin el campo id
                            const zoneToInsert = { ...zoneData, name: pendingZoneName, color: pendingZoneColor, coordinates: zoneData.coordinates, user_id: user.id };
                            const { error } = await supabase.from('zones').insert([zoneToInsert]);
                            console.log('DEBUG: Resultado de insert:', error);
                            if (error) {
                              alert('Error al guardar la zona: ' + error.message);
                            } else {
                              alert('Zona guardada correctamente');
                              setPendingZone(null);
                              setPendingZoneName('');
                              setPendingZoneColor('#3b82f6');
                              setIsDrawingZone(false); // <-- Permitir volver a crear otra zona
                              await reloadZones();
                              // Esperar a que la zona guardada esté en zones antes de limpiar pendingZone
                              const checkZoneInList = () => {
                                return zones.some(z => {
                                  // Comparar por nombre y color y coordenadas
                                  return (
                                    z.name === pendingZoneName &&
                                    z.color === pendingZoneColor &&
                                    JSON.stringify(z.coordinates) === coordinatesString
                                  );
                                });
                              };
                              let retries = 10;
                              while (!checkZoneInList() && retries > 0) {
                                await new Promise(res => setTimeout(res, 300));
                                await reloadZones();
                                retries--;
                              }
                              setPendingZone(null);
                              setPendingZoneName('');
                              setPendingZoneColor('#3b82f6');
                              setIsDrawingZone(false); // <-- Permitir volver a crear otra zona
                              await reloadZones();
                              // Log para ver si reloadZones trae datos
                              console.log('DEBUG: reloadZones ejecutado');
                              console.log('DEBUG: Zonas después de reloadZones:', zones);
                            }
                          } catch {
                            alert('Error inesperado al guardar la zona');
                          }
                        }
                      }}
                      disabled={!pendingZone || !pendingZoneName.trim() || (pendingZone?.coordinates.length ?? 0) < 4}
                    >
                      Guardar Zona
                    </button>
                    <button
                      className="bg-blue-500 text-white px-4 py-2 rounded shadow"
                      onClick={reloadZones}
                      type="button"
                    >
                      Recargar Zonas
                    </button>
                  </div>
                  <div className="mt-4">
                    <h4 className="font-bold mb-2">Zonas guardadas:</h4>
                    <ul className="space-y-2">
                      {groupedZones.map(z => (
                        <li key={z.name} className="flex items-center gap-2 bg-gray-100 rounded px-2 py-1">
                          <span className="font-semibold text-green-700">{z.name}</span>
                          <button
                            className="bg-red-500 text-white px-2 py-1 rounded text-xs ml-auto"
                            onClick={() => z.ids.forEach((id: string) => handleDelete(id))}
                          >
                            Eliminar
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </div>
      {/* Modal de puntos de recolección */}
      {showPointsModal && selectedUser && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center">
          <div className="bg-white rounded-lg shadow-lg p-6 w-full max-w-2xl relative">
            <button className="absolute top-2 right-2 text-gray-500 hover:text-red-600" onClick={() => setShowPointsModal(false)}>✕</button>
            <h3 className="text-lg font-bold mb-2">Puntos de {selectedUser.name || selectedUser.email}</h3>
            {pointsLoading ? <p>Cargando...</p> : pointsError ? <p className="text-red-600">{pointsError}</p> : points.length === 0 ? <p>No hay puntos.</p> : (
              <table className="w-full text-sm mb-2">
                <thead>
                  <tr>
                    <th>Dirección</th>
                    <th>Estado</th>
                    <th>Reciclador</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {points.map(point => (
                    <tr key={point.id}>
                      <td>{point.address}</td>
                      <td>{point.status}</td>
                      <td>{point.recycler_id ? (recyclers.find(r => r.user_id === point.recycler_id)?.name || point.recycler_id) : 'Sin asignar'}</td>
                      <td className="flex gap-2">
                        <button className="bg-red-500 hover:bg-red-600 text-white px-2 py-1 rounded text-xs" onClick={() => handleDeletePoint(point.id)}>Eliminar</button>
                        <select className="border rounded px-1 py-0.5 text-xs" value={point.recycler_id || ''} disabled={assigningPointId === point.id} onChange={e => handleAssignRecycler(point.id, e.target.value)}>
                          <option value="">Asignar reciclador</option>
                          {recyclers.map(r => (
                            <option key={r.user_id} value={r.user_id}>{r.name || r.email}</option>
                          ))}
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminPanel;
