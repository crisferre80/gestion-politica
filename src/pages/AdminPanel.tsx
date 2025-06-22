import React, { useEffect, useState, useRef, ReactNode, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { createNotification } from '../lib/notifications';
import AdminAds from './AdminAds';
import { TerraDraw } from "terra-draw";
import { TerraDrawMapboxGLAdapter } from "terra-draw-mapbox-gl-adapter";
import mapboxgl from "mapbox-gl";
import { TerraDrawPolygonMode, TerraDrawLineStringMode, TerraDrawPointMode, TerraDrawCircleMode, TerraDrawRectangleMode } from "terra-draw";

interface UserRow {
  avatar_url: string | null;
  id: string;
  user_id: string; // <-- Agregado para notificaciones
  name?: string; // <-- Agregado para resolver errores
  email?: string;
  role?: string;
  type?: string;
}

interface FeedbackRow {
  id: string;
  type: string;
  name: string;
  email: string;
  message: string;
  created_at: string;
}

interface CollectionPoint {
  address: ReactNode;
  recycler_id: string | null;
  id: string;
  location: string;
  user_id: string;
  resident_id?: string; // Añadido para evitar error de propiedad inexistente
}

const AdminPanel: React.FC = () => {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [notifTitle, setNotifTitle] = useState('');
  const [notifMsg, setNotifMsg] = useState('');
  const [notifType, setNotifType] = useState(''); // Nuevo estado para el tipo de notificación
  const [activeTab, setActiveTab] = useState('usuarios');
  const [selectedUser, setSelectedUser] = useState<UserRow | null>(null);
  const [, setRecyclers] = useState<UserRow[]>([]);
  const [feedbackData, setFeedbackData] = useState<FeedbackRow[]>([]);
  const [collectionPoints, setCollectionPoints] = useState<CollectionPoint[]>([]);
  // eslint-disable-next-line no-empty-pattern
  const [] = useState<string | null>(null);
  // Ref para drag-scroll en el carrusel de pestañas
  const tabCarouselRef = useRef<HTMLDivElement>(null);
  const [showModal, setShowModal] = useState(false); // Estado para mostrar el modal
  const [selectedRecycler, setSelectedRecycler] = useState<UserRow | null>(null);
  const [showPointsModal, setShowPointsModal] = useState(false);
  const [residentPoints, setResidentPoints] = useState<CollectionPoint[]>([]);
  const mapInstanceRef = useRef<mapboxgl.Map | null>(null);
  const [terraDrawInstance, setTerraDrawInstance] = useState<TerraDraw | null>(null);
  const [selectedTool, setSelectedTool] = useState<string>("Polygon");
  const [zoneName, setZoneName] = useState("");
  const [zoneColor, setZoneColor] = useState("#FF0000");

  // Drag to scroll para el carrusel de pestañas
  useEffect(() => {
    const el = tabCarouselRef.current;
    if (!el) return;
    let isDown = false;
    let startX = 0;
    let scrollLeft = 0;
    const onMouseDown = (e: MouseEvent) => {
      isDown = true;
      el.classList.add('cursor-grabbing');
      startX = e.pageX - el.offsetLeft;
      scrollLeft = el.scrollLeft;
    };
    const onMouseLeave = () => {
      isDown = false;
      el.classList.remove('cursor-grabbing');
    };
    const onMouseUp = () => {
      isDown = false;
      el.classList.remove('cursor-grabbing');
    };
    const onMouseMove = (e: MouseEvent) => {
      if (!isDown) return;
      e.preventDefault();
      const x = e.pageX - el.offsetLeft;
      const walk = (x - startX) * 1.2; // velocidad
      el.scrollLeft = scrollLeft - walk;
    };
    el.addEventListener('mousedown', onMouseDown);
    el.addEventListener('mouseleave', onMouseLeave);
    el.addEventListener('mouseup', onMouseUp);
    el.addEventListener('mousemove', onMouseMove);
    // Touch events para mobile
    let touchStartX = 0;
    let touchScrollLeft = 0;
    const onTouchStart = (e: TouchEvent) => {
      touchStartX = e.touches[0].pageX;
      touchScrollLeft = el.scrollLeft;
    };
    const onTouchMove = (e: TouchEvent) => {
      const x = e.touches[0].pageX;
      const walk = (x - touchStartX) * 1.2;
      el.scrollLeft = touchScrollLeft - walk;
    };
    el.addEventListener('touchstart', onTouchStart);
    el.addEventListener('touchmove', onTouchMove);
    return () => {
      el.removeEventListener('mousedown', onMouseDown);
      el.removeEventListener('mouseleave', onMouseLeave);
      el.removeEventListener('mouseup', onMouseUp);
      el.removeEventListener('mousemove', onMouseMove);
      el.removeEventListener('touchstart', onTouchStart);
      el.removeEventListener('touchmove', onTouchMove);
    };
  }, []);

  // Cargar usuarios y puntos de recolección
  useEffect(() => {
    const fetchUsersAndPoints = async () => {
      try {
        const { data: usersData, error: usersError } = await supabase.from('profiles').select('id, user_id, name, email, role, avatar_url');
        if (usersError) {
          console.error('Error al cargar usuarios:', usersError.message);
          alert(`Error al cargar usuarios: ${usersError.message}`);
          return;
        }
        if (usersData) {
          setUsers(usersData);
          if (!usersData.find(u => u.id === selectedUser?.id)) {
            setSelectedUser(null);
          }
        }
      } catch (err) {
        console.error('Error inesperado al cargar usuarios:', err);
        alert('Error inesperado al cargar usuarios. Verifique la conexión con el servidor.');
      }
    };
    fetchUsersAndPoints();
  }, [selectedUser]);

  // Cargar puntos de recolección
  useEffect(() => {
    const fetchCollectionPoints = async () => {
      try {
        const { data, error } = await supabase.from('collection_points').select('*');
        if (error) {
          console.error('Error al cargar puntos de recolección:', error.message);
          alert(`Error al cargar puntos de recolección: ${error.message}`);
          return;
        }
        if (data) {
          setCollectionPoints(data);
        }
      } catch (err) {
        console.error('Error inesperado al cargar puntos de recolección:', err);
        alert('Error inesperado al cargar puntos de recolección. Verifique la conexión con el servidor.');
      }
    };
    fetchCollectionPoints();
  }, []); // Asegurar que los puntos se carguen al inicio

  // Refrescar usuarios después de enviar notificación global o eliminar usuario
  const refreshUsers = async () => {
    const { data, error } = await supabase.from('profiles').select('id, user_id, name, email, role, avatar_url');
    if (!error && data) {
      setUsers(data);
      if (selectedUser && !data.find(u => u.id === selectedUser.id)) {
        setSelectedUser(null);
      }
    } else {
      alert('Error al cargar usuarios');
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (!window.confirm('¿Seguro que deseas eliminar este usuario?')) return;
    await supabase.from('profiles').delete().eq('id', userId);
    await refreshUsers();
  };

  const playNotificationSound = () => {
    const audio = new Audio('/assets/duvan_hincapie3.mp3');
    audio.play().catch((error) => {
      console.error('Error al reproducir el sonido de notificación:', error);
    });
  };

  const handleSendNotification = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      let filteredUsers = users;

      // Filtrar usuarios según el tipo de notificación seleccionado
      if (notifType === 'Recicladores') {
        filteredUsers = users.filter(user => user.role === 'recycler');
      } else if (notifType === 'Residentes') {
        filteredUsers = users.filter(user => user.role === 'resident');
      } else if (notifType === 'Individual' && selectedUser) {
        filteredUsers = [selectedUser];
      }

      for (const u of filteredUsers) {
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

      await refreshUsers();
      setNotifTitle('');
      setNotifMsg('');

      // Reproducir sonido de notificación
      playNotificationSound();
    } catch (err) {
      console.error('[NOTIF][ERROR] Error al enviar notificaciones:', err);
    }
  };

  // Cargar recicladores para asignación
  useEffect(() => {
    const fetchRecyclers = async () => {
      const { data } = await supabase.from('profiles').select('id, user_id, name, email, role, avatar_url').eq('role', 'recycler');
      if (data) setRecyclers(data as UserRow[]);
    };
    fetchRecyclers();
  }, []);

  // Eliminar punto de recolección

  // Asignar punto a reciclador
  const assignCollectionPointToRecycler = async (recyclerId: string, pointId: string) => {
    try {
      const { error } = await supabase
        .from('collection_points')
        .update({ recycler_id: recyclerId })
        .eq('id', pointId);

      if (error) {
        console.error('Error al asignar punto de recolección:', error);
        alert('No se pudo asignar el punto de recolección.');
      } else {
        alert('Punto de recolección asignado exitosamente.');
        const updatedPoints = collectionPoints.map(point =>
          point.id === pointId ? { ...point, recycler_id: recyclerId } : point
        );
        setCollectionPoints(updatedPoints);
      }
    } catch (err) {
      console.error('Error inesperado al asignar punto de recolección:', err);
    }
  };

  const handleSelectUser = (user: UserRow) => {
    setSelectedUser(user);
    setShowModal(false); // Cerrar el modal después de seleccionar
  };

  const handleAssignPoint = async (recyclerId: string, pointId: string) => {
    await assignCollectionPointToRecycler(recyclerId, pointId);
  };

  const fetchResidentPoints = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('collection_points')
        .select('*')
        .eq('user_id', userId);

      if (error) {
        throw new Error(`Error al obtener puntos de recolección: ${error.message}`);
      }

      setResidentPoints(data || []);
    } catch (error) {
      console.error('Error fetching resident points:', error);
      const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
      alert(errorMessage);
    }
  };

  const handleShowPoints = async (userId: string) => {
    await fetchResidentPoints(userId);
    setShowPointsModal(true);
  };

  // Efecto para cargar feedback cuando la pestaña 'Feedback' está activa
  useEffect(() => {
    if (activeTab === 'feedback') {
      const fetchFeedback = async () => {
        try {
          const { data, error } = await supabase.from('feedback').select('*');
          if (error) {
            console.error('Error al cargar feedback:', error.message);
            alert(`Error al cargar feedback: ${error.message}`);
            return;
          }
          if (data) {
            setFeedbackData(data);
          }
        } catch (err) {
          console.error('Error inesperado al cargar feedback:', err);
          alert('Error inesperado al cargar feedback. Verifique la conexión con el servidor.');
        }
      };
      fetchFeedback();
    }
  }, [activeTab]);

  const handleSaveZones = useCallback(async (geojson: GeoJSON.FeatureCollection) => {
    try {
      // Convertir polígonos a puntos GeoJSON
      const pointsGeoJSON: GeoJSON.FeatureCollection = {
        type: "FeatureCollection",
        features: geojson.features.flatMap((feature) => {
          if (feature.geometry.type === "Polygon") {
            const coordinates = feature.geometry.coordinates[0]; // Obtener los vértices del polígono
            return coordinates.map((coord) => ({
              type: "Feature" as const,
              geometry: {
                type: "Point" as const,
                coordinates: coord,
              },
              properties: feature.properties || {},
            }));
          }
          return [feature]; // Mantener otros tipos de geometría sin cambios
        }).flat(),
      };

      const { data, error } = await supabase.from("zones").insert({
        coordinates: pointsGeoJSON,
        name: zoneName || "Zona generada",
        color: zoneColor || "#FF0000",
        user_id: "a2a423a1-ac51-4a6b-8588-34918d8d81df", // ID de usuario por defecto
      }).select("coordinates, name, color");

      if (error) {
        console.error("Error al guardar zonas como puntos GeoJSON:", error);
        alert("No se pudo guardar las zonas como puntos GeoJSON.");
      } else {
        alert("Zonas guardadas exitosamente como puntos GeoJSON.");

        // Agregar la zona recién creada al mapa
        if (data && mapInstanceRef.current) {
          const mapInstance = mapInstanceRef.current; // Asegurar que no sea null
          data.forEach((zone) => {
            try {
              const geojsonSource: mapboxgl.GeoJSONSourceSpecification = {
                type: "geojson",
                data: JSON.parse(zone.coordinates),
              };

              if (!mapInstance.getSource(zone.name)) {
                mapInstance.addSource(zone.name, geojsonSource);

                mapInstance.addLayer({
                  id: zone.name,
                  type: "fill",
                  source: zone.name,
                  paint: {
                    "fill-color": zone.color || "#0000FF",
                    "fill-opacity": 0.5,
                  },
                });
              } else {
                console.warn(`La fuente con el nombre ${zone.name} ya existe.`);
              }
            } catch (err) {
              console.error(`Error al procesar la zona ${zone.name}:`, err);
            }
          });
        }
      }
    } catch (err) {
      console.error("Error inesperado al guardar zonas como puntos GeoJSON:", err);
    }
  }, [zoneName, zoneColor]);

  mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN; // Usar el token desde las variables de entorno

  const handleDrawZones = useCallback(() => {
    const container = document.getElementById("map-container");
    if (!container) {
      console.error("No se encontró el contenedor del mapa.");
      return;
    }

    container.style.width = "100%";
    container.style.height = "400px";

    if (!mapInstanceRef.current) {
      try {
        const map = new mapboxgl.Map({
          container: container,
          style: "mapbox://styles/mapbox/streets-v11",
          center: [-64.2667, -27.7833],
          zoom: 13,
        });

        map.on("style.load", () => {
          const mapboxAdapter = new TerraDrawMapboxGLAdapter({
            map: map,
          });

          const terraDraw = new TerraDraw({
            adapter: mapboxAdapter,
            modes: [
              new TerraDrawPolygonMode(),
              new TerraDrawLineStringMode(),
              new TerraDrawPointMode(),
              new TerraDrawCircleMode(),
              new TerraDrawRectangleMode(),
            ],
          });

          terraDraw.start();
          setTerraDrawInstance(terraDraw);
          mapInstanceRef.current = map;
        });
      } catch (error) {
        console.error("Error al inicializar el mapa:", error);
      }
    } else {
      console.log("El mapa ya está inicializado.");
    }
  }, []);

  useEffect(() => {
    if (activeTab === "mapa") {
      console.log("Activando la pestaña 'Mapa de Zonas'. Inicializando el mapa...");
      handleDrawZones();

      // Forzar la visibilidad del mapa
      const container = document.getElementById("map-container");
      if (container) {
        container.style.display = "block";
      }
    } else {
      // Ocultar el mapa cuando se cambia de sección
      const container = document.getElementById("map-container");
      if (container) {
        container.style.display = "none";
      }
    }
  }, [activeTab, handleDrawZones]);

  useEffect(() => {
    if (terraDrawInstance && selectedTool) {
      try {
        terraDrawInstance.setMode(selectedTool.toLowerCase());
      } catch (error) {
        console.error(`Error al cambiar el modo de dibujo a ${selectedTool}:`, error);
      }
    }
  }, [selectedTool, terraDrawInstance]);

  // Agregar efecto para cargar zonas desde Supabase y mostrarlas en el mapa
  useEffect(() => {
    const fetchZones = async () => {
        try {
            const { data, error } = await supabase.from("zones").select("coordinates, name, color");
            if (error) {
                console.error("Error al cargar zonas desde Supabase:", error.message);
                return;
            }

            if (data && mapInstanceRef.current) {
                data.forEach((zone) => {
                    if (mapInstanceRef.current) {
                        try {
                            const geojsonSource: mapboxgl.GeoJSONSourceSpecification = {
                                type: "geojson",
                                data: JSON.parse(zone.coordinates),
                            };

                            if (!mapInstanceRef.current.getSource(zone.name)) {
                                mapInstanceRef.current.addSource(zone.name, geojsonSource);

                                mapInstanceRef.current.addLayer({
                                    id: zone.name,
                                    type: "fill",
                                    source: zone.name,
                                    paint: {
                                        "fill-color": zone.color || "#0000FF",
                                        "fill-opacity": 0.5,
                                    },
                                });
                            } else {
                                console.warn(`La fuente con el nombre ${zone.name} ya existe.`);
                            }
                        } catch (err) {
                            console.error(`Error al procesar la zona ${zone.name}:`, err);
                        }
                    }
                });
            }
        } catch (err) {
            console.error("Error inesperado al cargar zonas desde Supabase:", err);
        }
    };

    if (activeTab === "mapa" && mapInstanceRef.current) {
        fetchZones();
    }
  }, [activeTab]);

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="mb-4">
        <h1 className="text-2xl font-bold">Panel de Administración</h1>
      </div>
      <div className="mb-4">
        <div className="flex space-x-2 overflow-auto hide-scrollbar" ref={tabCarouselRef}>
          <button
            onClick={() => setActiveTab('usuarios')}
            className={`px-4 py-2 rounded-lg font-semibold transition-all flex-shrink-0 ${activeTab === 'usuarios' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-800'}`}
          >
            Usuarios
          </button>
          <button
            onClick={() => setActiveTab('notificaciones')}
            className={`px-4 py-2 rounded-lg font-semibold transition-all flex-shrink-0 ${activeTab === 'notificaciones' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-800'}`}
          >
            Notificaciones
          </button>
          <button
            onClick={() => setActiveTab('feedback')}
            className={`px-4 py-2 rounded-lg font-semibold transition-all flex-shrink-0 ${activeTab === 'feedback' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-800'}`}
          >
            Feedback
          </button>
          <button
            onClick={() => setActiveTab('publicidades')}
            className={`px-4 py-2 rounded-lg font-semibold transition-all flex-shrink-0 ${activeTab === 'publicidades' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-800'}`}
          >
            Publicidades
          </button>
          <button
            onClick={() => setActiveTab("mapa")}
            className={`px-4 py-2 rounded-lg font-semibold transition-all flex-shrink-0 ${activeTab === "mapa" ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-800"}`}
          >
            Mapa de Zonas
          </button>
        </div>
      </div>
      {activeTab === 'usuarios' && (
        <div>
          <h2 className="text-xl font-semibold mb-4">Usuarios</h2>
          {users.length === 0 ? (
            <p className="text-gray-500">No hay usuarios registrados.</p>
          ) : (
            <div className="bg-white shadow rounded-lg p-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {users.map(user => (
                  <div key={user.id} className="border rounded-lg p-4 flex flex-col sm:flex-row items-start sm:items-center space-x-4">
                    <img src={user.avatar_url || '/default-avatar.png'} alt={user.name} className="w-16 h-16 rounded-full object-cover" />
                    <div className="flex-1 min-w-0">
                      <p className="text-lg font-semibold truncate">{user.name}</p>
                      <p className="text-sm text-gray-500 truncate">{user.email}</p>
                      <p className="text-sm font-medium" style={{ color: user.role === 'admin' ? 'blue' : user.role === 'recycler' ? 'green' : 'orange' }}>
                        {user.role === 'admin' ? 'Administrador' : user.role === 'recycler' ? 'Reciclador' : 'Residente'}
                      </p>
                      {user.role === 'resident' && (
                        <div className="mt-2">
                          <h4 className="text-sm font-semibold">Puntos de Recolección:</h4>
                          <ul className="list-disc pl-5">
                            {collectionPoints.filter(point => point.user_id === user.user_id).map(point => (
                              <li key={point.id}>{point.location}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                    <div className="flex-shrink-0 space-y-2">
                      <button
                        onClick={() => handleDeleteUser(user.id)}
                        className="px-3 py-1 text-sm rounded-lg bg-red-600 text-white font-semibold transition-all flex items-center space-x-2"
                      >
                        <span>Eliminar Usuario</span>
                      </button>
                      {user.role === 'resident' && (
                        <button
                          onClick={() => handleShowPoints(user.user_id)}
                          className="relative px-3 py-1 text-sm rounded-lg bg-blue-600 text-white font-semibold transition-all flex items-center space-x-2"
                        >
                          <span>Puntos</span>
                          {collectionPoints.filter(point => point.user_id === user.user_id).length > 0 && (
                            <span className="absolute top-0 right-0 transform translate-x-1/2 -translate-y-1/2 bg-red-500 text-white text-xs rounded-full px-2 py-0.5 shadow-lg z-50">
                              {collectionPoints.filter(point => point.user_id === user.user_id).length}
                            </span>
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
      {activeTab === 'notificaciones' && (
        <div>
          <h2 className="text-xl font-semibold mb-4">Notificaciones</h2>
          <form onSubmit={handleSendNotification} className="mb-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Título</label>
                <input
                  type="text"
                  value={notifTitle}
                  onChange={e => setNotifTitle(e.target.value)}
                  className="block w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Mensaje</label>
                <textarea
                  value={notifMsg}
                  onChange={e => setNotifMsg(e.target.value)}
                  className="block w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent"
                  rows={3}
                  required
                />
              </div>
            </div>
            <div className="mt-4">
              <h3 className="text-lg font-semibold mb-4">Opciones de Notificación</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <button
                  onClick={() => setNotifType('Global')} // Cambiar a notifType
                  className={`px-4 py-2 rounded-lg font-semibold transition-all flex items-center space-x-2 ${notifType === 'Global' ? 'bg-blue-800 text-white' : 'bg-blue-600 text-gray-200'}`}
                >
                  <span>Global</span>
                </button>
                <button
                  onClick={() => {
                    setNotifType('Individual');
                    setShowModal(true); // Mostrar el modal
                  }}
                  className={`px-4 py-2 rounded-lg font-semibold transition-all flex items-center space-x-2 ${notifType === 'Individual' ? 'bg-gray-800 text-white' : 'bg-gray-600 text-gray-200'}`}
                >
                  <span>Individual</span>
                </button>
                <button
                  onClick={() => setNotifType('Recicladores')} // Cambiar a notifType
                  className={`px-4 py-2 rounded-lg font-semibold transition-all flex items-center space-x-2 ${notifType === 'Recicladores' ? 'bg-green-800 text-white' : 'bg-green-600 text-gray-200'}`}
                >
                  <span>Recicladores</span>
                </button>
                <button
                  onClick={() => setNotifType('Residentes')} // Cambiar a notifType
                  className={`px-4 py-2 rounded-lg font-semibold transition-all flex items-center space-x-2 ${notifType === 'Residentes' ? 'bg-orange-800 text-white' : 'bg-orange-600 text-gray-200'}`}
                >
                  <span>Residentes</span>
                </button>
              </div>
              <div className="mt-4">
                <p className="text-sm text-gray-700 font-semibold">Destinatario seleccionado: <span className="text-blue-600">{notifType}</span></p>
              </div>
              <div className="mt-4">
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-blue-600 text-white font-semibold transition-all flex items-center space-x-2"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12H9m6 4H9m6-8H9m6 4H9m6-8H9" />
                  </svg>
                  <span>Enviar</span>
                </button>
              </div>
            </div>
          </form>
        </div>
      )}
      {activeTab === 'feedback' && (
        <div>
          <h2 className="text-xl font-semibold mb-4">Feedback</h2>
          {feedbackData.length === 0 ? (
            <p className="text-gray-500">No hay feedback registrado.</p>
          ) : (
            <div className="bg-white shadow rounded-lg p-4">
              <ul className="space-y-4">
                {feedbackData.map((item) => (
                  <li key={item.id} className="border rounded-lg p-4">
                    <p className="text-lg font-semibold">{item.name}</p>
                    <p className="text-sm text-gray-500">{item.email}</p>
                    <p className="text-sm text-gray-700">{item.message}</p>
                    <p className="text-xs text-gray-400">{new Date(item.created_at).toLocaleString()}</p>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
      {activeTab === 'publicidades' && (
        <div>
          <h2 className="text-xl font-semibold mb-4">Publicidades</h2>
          <p className="text-gray-500">Aquí puedes gestionar las publicidades.</p>
          <AdminAds />
        </div>
      )}
      {activeTab === "mapa" && (
        <div>
          <h2 className="text-xl font-semibold mb-4">Mapa de Zonas</h2>
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">Nombre de la Zona</label>
            <input
              type="text"
              value={zoneName}
              onChange={(e) => setZoneName(e.target.value)}
              className="block w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent"
              placeholder="Ejemplo: Zona Norte"
              required
            />
          </div>
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">Color de la Zona</label>
            <input
              type="color"
              value={zoneColor}
              onChange={(e) => setZoneColor(e.target.value)}
              className="block w-16 h-10 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent"
            />
          </div>
          <div className="flex space-x-4 mb-4">
            {["Polygon", "LineString", "Point", "Circle", "Rectangle"].map((tool) => (
              <button
                key={tool}
                onClick={() => setSelectedTool(tool)}
                className={`px-4 py-2 rounded-lg font-semibold transition-all ${selectedTool === tool ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-800"}`}
              >
                {tool}
              </button>
            ))}
          </div>
          <div className="flex space-x-4 mb-4">
            <button
              onClick={() => {
                if (terraDrawInstance) {
                  terraDrawInstance.setMode("edit");
                }
              }}
              className="px-4 py-2 rounded-lg bg-yellow-600 text-white font-semibold transition-all"
            >
              Editar Forma
            </button>
            <button
              onClick={async () => {
                if (terraDrawInstance && mapInstanceRef.current) {
                  const selectedFeatureIds = terraDrawInstance.getFeatureId();

                  // Asegurarse de que `selectedFeatureIds` sea un array
                  const featureIdsArray = Array.isArray(selectedFeatureIds) ? selectedFeatureIds : [selectedFeatureIds];

                  if (featureIdsArray.length > 0) {
                    terraDrawInstance.removeFeatures(featureIdsArray);

                    // Eliminar de la base de datos
                    try {
                      await Promise.all(
                        featureIdsArray.map((id) =>
                          supabase.from("zones").delete().eq("id", id.toString())
                        )
                      );
                      alert("Zona(s) eliminada(s) exitosamente.");
                    } catch (error) {
                      console.error("Error al eliminar zonas:", error);
                      alert("No se pudo eliminar la(s) zona(s).");
                    }
                  } else {
                    alert("No hay zonas seleccionadas para eliminar.");
                  }
                }
              }}
              className="px-4 py-2 rounded-lg bg-red-600 text-white font-semibold transition-all"
            >
              Borrar
            </button>
          </div>
          <div id="map-container" className="w-full h-96 border rounded-lg"></div>
          <button
            id="save-zones-button"
            onClick={() => {
              if (terraDrawInstance) {
                const geojson = terraDrawInstance.getSnapshot();
                handleSaveZones({
                  type: "FeatureCollection",
                  features: geojson,
                });
              }
            }}
            className="mt-4 px-4 py-2 rounded-lg bg-blue-600 text-white font-semibold transition-all"
          >
            Guardar Zonas
          </button>
        </div>
      )}
      {selectedUser && (
        <div className="mt-8 p-4 bg-white shadow rounded-lg">
          <h3 className="text-lg font-semibold mb-4">Detalles del Usuario</h3>
          <div className="flex flex-col sm:flex-row sm:items-center mb-4">
            <img src={selectedUser.avatar_url || '/default-avatar.png'} alt={selectedUser.name} className="w-16 h-16 rounded-full object-cover mr-4" />
            <div className="flex-1 min-w-0">
              <p className="text-lg font-semibold truncate">{selectedUser.name}</p>
              <p className="text-sm text-gray-500 truncate">{selectedUser.email}</p>
              <p className="text-sm font-medium" style={{ color: selectedUser.role === 'admin' ? 'blue' : selectedUser.role === 'recycler' ? 'green' : 'orange' }}>
                {selectedUser.role === 'admin' ? 'Administrador' : selectedUser.role === 'recycler' ? 'Reciclador' : 'Residente'}
              </p>
            </div>
          </div>
          <div className="mb-4">
            <h4 className="text-md font-semibold mb-2">Puntos de Recolección Asignados</h4>
            {/* Aquí se mostrarán los puntos de recolección asignados al usuario seleccionado */}
          </div>
          <div className="mt-4">
            <h4 className="text-md font-semibold mb-2">Asignar Punto de Recolección</h4>
            <div className="flex flex-col space-y-2">
              {collectionPoints.map(point => (
                <div key={point.id} className="flex items-center justify-between p-2 border rounded-lg">
                  <span>{point.location}</span>
                  <button
                    onClick={() => handleAssignPoint(selectedUser?.id || '', point.id)}
                    className="px-3 py-1 text-sm rounded-lg bg-blue-600 text-white font-semibold"
                  >
                    Asignar a {selectedUser?.name || 'Reciclador'}
                  </button>
                </div>
              ))}
            </div>
          </div>
          <div className="flex flex-col sm:flex-row sm:space-x-4">
            <button
              onClick={() => handleDeleteUser(selectedUser.id)}
              className="px-4 py-2 rounded-lg bg-red-600 text-white font-semibold transition-all flex items-center space-x-2"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
              <span>Eliminar Usuario</span>
            </button>
            <button
              onClick={() => setSelectedUser(null)}
              className="px-4 py-2 rounded-lg bg-gray-300 text-gray-800 font-semibold transition-all flex items-center space-x-2"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12H9m6 4H9m6-8H9m6 4H9m6-8H9" />
              </svg>
              <span>Cancelar</span>
            </button>
          </div>
        </div>
      )}
      {showModal && (
        <div className="fixed inset-0 bg-gray-800 bg-opacity-50 flex items-center justify-center">
          <div className="bg-white rounded-lg p-6 w-96">
            <h3 className="text-lg font-semibold mb-4">Seleccionar Usuario</h3>
            <ul className="space-y-2">
              {users.map(user => (
                <li
                  key={user.id}
                  className="flex items-center justify-between p-2 border rounded-lg hover:bg-gray-100 cursor-pointer"
                  onClick={() => handleSelectUser(user)}
                >
                  <span>{user.name || 'Usuario sin nombre'}</span>
                  <span className="text-sm text-gray-500">{user.email}</span>
                </li>
              ))}
            </ul>
            <button
              onClick={() => setShowModal(false)}
              className="mt-4 px-4 py-2 rounded-lg bg-red-600 text-white font-semibold"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
      {showPointsModal && (
        <div className="fixed inset-0 bg-gray-800 bg-opacity-50 flex items-center justify-center">
          <div className="bg-white rounded-lg p-4 w-96 sm:w-[32rem]">
            <h3 className="text-lg font-semibold mb-4">Puntos de Recolección</h3>
            {residentPoints.length === 0 ? (
              <p className="text-sm text-gray-500">No hay puntos de recolección creados por este residente.</p>
            ) : (
              <ul className="space-y-2">
                {residentPoints.map(point => (
                  <li key={point.id} className="flex items-center justify-between p-1 border rounded-lg text-sm">
                    <span className="truncate w-4/5 h-6">{point.address}</span>
                    <select
                      onChange={e => setSelectedRecycler(users.find(user => user.id === e.target.value) || null)}
                      className="px-0.5 py-2 text-xs rounded-lg border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-600 w-1/5"
                    >
                      <option value="">--Reciclador--</option>
                      {users.filter(user => user.role === 'recycler').map(recycler => (
                        <option key={recycler.id} value={recycler.id}>{recycler.name}</option>
                      ))}
                    </select>
                    <button
                      onClick={() => selectedRecycler && handleAssignPoint(selectedRecycler.id, point.id)}
                      className="px-2 py-1 text-xs rounded-lg bg-green-600 text-white font-semibold"
                    >
                      Asignar
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <button
              onClick={() => setShowPointsModal(false)}
              className="mt-4 px-3 py-1 text-sm rounded-lg bg-red-600 text-white font-semibold"
            >
              Cerrar
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminPanel;
