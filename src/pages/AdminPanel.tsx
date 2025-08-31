import React, { useEffect, useState, useRef, ReactNode, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { createNotification } from '../lib/notifications';
import AdminAds from './AdminAds';
import NotificationManager from '../components/NotificationManager';
import { loadFeedbackSafely, getAvatarUrl } from '../utils/feedbackHelper';
import { sendBulkEmailNotifications, verifyEmailService } from '../lib/emailService';
import { TerraDraw } from "terra-draw";
import { TerraDrawMapboxGLAdapter } from "terra-draw-mapbox-gl-adapter";
import mapboxgl from "mapbox-gl";
import { TerraDrawPolygonMode, TerraDrawLineStringMode, TerraDrawPointMode, TerraDrawCircleMode, TerraDrawRectangleMode, TerraDrawSelectMode } from "terra-draw";
import type { Feature, FeatureCollection, Polygon } from "geojson";

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
  const [sendEmail, setSendEmail] = useState(false); // Control para envío de correo
  const [emailButtonText, setEmailButtonText] = useState(''); // Texto para botón de correo (opcional)
  const [emailButtonUrl, setEmailButtonUrl] = useState(''); // URL para botón de correo (opcional)
  const [emailServiceStatus, setEmailServiceStatus] = useState<'unchecked' | 'available' | 'unavailable'>('unchecked');
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
  const [userFilter, setUserFilter] = useState<string>("todos"); // Estado para el filtro de usuarios

  // Filtrar usuarios según el rol seleccionado
  const filteredUsers = users.filter(user => {
    if (userFilter === "todos") return true;
    return user.role === userFilter;
  });

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

  const fetchUsersAndPoints = useCallback(async () => {
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
  }, [selectedUser]);

  const fetchCollectionPoints = useCallback(async () => {
    try {
    const { data, error } = await supabase.from('concentration_points').select('*');
      if (error) {
        console.error('Error al cargar Centros de Movilizaciòn:', error.message);
        alert(`Error al cargar Centros de Movilizaciòn: ${error.message}`);
        return;
      }
      if (data) {
        setCollectionPoints(data);
      }
    } catch (err) {
      console.error('Error inesperado al cargar Centros de Movilizaciòn:', err);
      alert('Error inesperado al cargar Centros de Movilizaciòn. Verifique la conexión con el servidor.');
    }
  }, []);

  // Cargar usuarios y Centros de Movilizaciòn
  useEffect(() => {
    fetchUsersAndPoints();
  }, [selectedUser, fetchUsersAndPoints]);

  useEffect(() => {
    fetchCollectionPoints();
  }, [fetchCollectionPoints]);
  
  // Verificar disponibilidad del servicio de correo
  useEffect(() => {
    const checkEmailService = async () => {
      try {
        const isAvailable = await verifyEmailService();
        setEmailServiceStatus(isAvailable ? 'available' : 'unavailable');
        console.log(`Servicio de email ${isAvailable ? 'disponible' : 'no disponible'}`);
      } catch (error) {
        console.error('Error al verificar servicio de email:', error);
        setEmailServiceStatus('unavailable');
      }
    };
    
    checkEmailService();
  }, []);

  // Agregar suscripción en tiempo real a la tabla concentration_points
  useEffect(() => {
  const subscription = supabase
    .channel('concentration_points')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'concentration_points' }, (payload) => {
      console.log('Cambio detectado en concentration_points:', payload);
      fetchCollectionPoints(); // Refrescar Centros de Movilizaci2n
    })
    .subscribe();

    return () => {
        supabase.removeChannel(subscription);
    };
  }, [fetchCollectionPoints]);

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

  const refreshData = async () => {
    await fetchUsersAndPoints();
    await fetchCollectionPoints();
  };

  const handleDeleteUser = async (userId: string) => {
    if (!window.confirm('¿Seguro que deseas eliminar este usuario?')) return;
    await supabase.from('profiles').delete().eq('id', userId);
    await refreshData();
  };

  const handleSendNotification = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      let filteredUsers = users;

      // Filtrar usuarios según el tipo de notificación seleccionado
      if (notifType === 'Dirigentes') {
        filteredUsers = users.filter(user => user.role === 'recycler');
      } else if (notifType === 'Referentes') {
        filteredUsers = users.filter(user => user.role === 'resident');
      } else if (notifType === 'Individual' && selectedUser) {
        filteredUsers = [selectedUser];
      }

      // Enviar notificaciones en la app
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
      
      // Enviar notificaciones por correo electrónico si está habilitado
      if (sendEmail && emailServiceStatus === 'available') {
        const validRecipients = filteredUsers
          .filter(user => user.email) // Filtrar usuarios sin correo
          .map(user => ({
            email: user.email || '',
            name: user.name || 'Usuario'
          }));
          
        if (validRecipients.length > 0) {
          try {
            const { successful, failed } = await sendBulkEmailNotifications(
              validRecipients,
              {
                subject: `Econecta - ${notifTitle}`,
                title: notifTitle,
                content: notifMsg,
                buttonText: emailButtonText || undefined,
                buttonUrl: emailButtonUrl || undefined
              }
            );
            
            console.log(`Correos enviados: ${successful}, fallidos: ${failed}`);
            if (failed > 0) {
              alert(`Se enviaron ${successful} correos, pero fallaron ${failed}.`);
            } else if (successful > 0) {
              alert(`Se enviaron ${successful} correos electrónicos exitosamente.`);
            }
          } catch (err) {
            console.error('[EMAIL][ERROR] Error al enviar correos:', err);
            alert('Hubo un error al enviar los correos electrónicos.');
          }
        } else {
          alert('No hay destinatarios con correo electrónico válido.');
        }
      }

      await refreshUsers();
      setNotifTitle('');
      setNotifMsg('');
      // Mantener los valores de los campos de correo para futuras notificaciones
    } catch (err) {
      console.error('[NOTIF][ERROR] Error al enviar notificaciones:', err);
      alert('Ocurrió un error al enviar las notificaciones.');
    }
  };

  // Cargar Dirigentes para asignación
  useEffect(() => {
    const fetchRecyclers = async () => {
      const { data } = await supabase.from('profiles').select('id, user_id, name, email, role, avatar_url').eq('role', 'recycler');
      if (data) setRecyclers(data as UserRow[]);
    };
    fetchRecyclers();
  }, []);
  
  // Función para extraer listas de correos electrónicos
  const extractEmails = (filteredUsers: UserRow[]): string => {
    return filteredUsers
      .filter(user => user.email)
      .map(user => user.email)
      .join(', ');
  };

  // Eliminar punto de recolección

  // Asignar punto a reciclador
  const assignCollectionPointToRecycler = async (recyclerId: string, pointId: string) => {
    try {
      const { error } = await supabase
        .from('concentration_points')
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
    await refreshData();
  };

  const fetchResidentPoints = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('concentration_points')
        .select('*')
        .eq('user_id', userId);

      if (error) {
        throw new Error(`Error al obtener Centros de Movilizaciòn: ${error.message}`);
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
          // Usar nuestra función segura que evita problemas de recursión
          const { data, error } = await loadFeedbackSafely();
          
          if (error) {
            console.error('Error al cargar feedback:', error instanceof Error ? error.message : 'Error desconocido');
            alert(`Error al cargar feedback: ${error instanceof Error ? error.message : 'Error desconocido'}`);
            return;
          }
          
          setFeedbackData(data || []);
        } catch (err) {
          console.error('Error inesperado al cargar feedback:', err);
          const errorMessage = err instanceof Error ? err.message : 'Error desconocido';
          alert(`Error inesperado al cargar feedback: ${errorMessage}`);
        }
      };
      fetchFeedback();
    }
  }, [activeTab]);

  // --- INICIO CAMBIO: función para limpiar y recargar zonas ---
  const renderZonePolygon = (
    map: mapboxgl.Map,
    terraDrawInstance: TerraDraw,
    zone: { coordinates: unknown; name: string; color: string },
    idx: number
  ) => {
    const geojsonData = typeof zone.coordinates === "string"
      ? JSON.parse(zone.coordinates)
      : zone.coordinates;
    let polygonGeoJSON: FeatureCollection<Polygon> | null = null;
    if (
      geojsonData &&
      geojsonData.type === "FeatureCollection" &&
      Array.isArray(geojsonData.features) &&
      geojsonData.features.length > 2 &&
      geojsonData.features.every((f: Feature) => f.geometry.type === "Point")
    ) {
      const coords = geojsonData.features.map((f: Feature) =>
        f.geometry.type === 'Point' ? (f.geometry.coordinates as [number, number]) : null
      ).filter(Boolean) as [number, number][];
      if (
        coords.length > 0 &&
        (coords[0][0] !== coords[coords.length - 1][0] || coords[0][1] !== coords[coords.length - 1][1])
      ) {
        coords.push(coords[0]);
      }
      polygonGeoJSON = {
        type: "FeatureCollection",
        features: [
          {
            type: "Feature",
            geometry: {
              type: "Polygon",
              coordinates: [coords],
            },
            properties: { name: zone.name, color: zone.color },
            id: zone.name || `zona-${idx}`,
          },
        ],
      };
    } else if (
      geojsonData &&
      geojsonData.type === "FeatureCollection" &&
      Array.isArray(geojsonData.features) &&
      geojsonData.features.length > 0 &&
      geojsonData.features[0].geometry.type === "Polygon"
    ) {
      polygonGeoJSON = geojsonData as FeatureCollection<Polygon>;
    }
    if (polygonGeoJSON && polygonGeoJSON.features.length > 0) {
      // Limpiar fuente/capa si existe
      if (map.getSource(zone.name)) map.removeSource(zone.name);
      if (map.getLayer(zone.name)) map.removeLayer(zone.name);
      if (map.getLayer(`${zone.name}-label`)) map.removeLayer(`${zone.name}-label`);
      // Agregar fuente/capa
      map.addSource(zone.name, {
        type: "geojson",
        data: polygonGeoJSON,
      });
      map.addLayer({
        id: zone.name,
        type: "fill",
        source: zone.name,
        paint: {
          "fill-color": zone.color || "#0000FF",
          "fill-opacity": 0.5,
        },
      });
      // Capa de símbolo para el nombre de la zona
      map.addLayer({
        id: `${zone.name}-label`,
        type: "symbol",
        source: zone.name,
        layout: {
          "text-field": ["get", "name"],
          "text-size": 16,
          "text-font": ["Open Sans Bold", "Arial Unicode MS Bold"],
          "text-anchor": "center",
        },
        paint: {
          "text-color": "#222",
          "text-halo-color": "#fff",
          "text-halo-width": 2,
        },
        filter: ["==", "$type", "Polygon"],
      });
      // Importar solo features tipo Polygon a TerraDraw
      const polygonFeatures = polygonGeoJSON.features.filter((f: Feature) => f.geometry.type === 'Polygon') as Feature<Polygon>[];
      if (polygonFeatures.length > 0) {
        terraDrawInstance.addFeatures(
          polygonFeatures.map((f, i) => ({
            ...f,
            id: f.id || `${zone.name || 'zona'}-${i}`,
            properties: { ...f.properties, name: zone.name, color: zone.color },
          }))
        );
      }
    }
  };

  const reloadZonesOnMap = useCallback(async () => {
    if (!mapInstanceRef.current || !terraDrawInstance) return;
    const map = mapInstanceRef.current;
    try {
      // Obtener nombres de zonas existentes en la base
      const { data, error } = await supabase.from("zones").select("coordinates, name, color");
      if (error) {
        console.error("Error al cargar zonas desde Supabase:", error.message);
        return;
      }
      // Limpiar solo capas/fuentes de zonas (no internas de Mapbox ni de TerraDraw)
      if (data) {
        const zoneNames = data.map((zone: { name: string }) => zone.name);
        const style = map.getStyle();
        if (style && style.layers) {
          // Eliminar primero las capas de zona
          style.layers.forEach((layer) => {
            if (zoneNames.includes(layer.id) && map.getLayer(layer.id)) {
              map.removeLayer(layer.id);
            }
          });
          // Luego eliminar las fuentes de zona
          Object.keys(style.sources).forEach((sourceName) => {
            if (zoneNames.includes(sourceName) && map.getSource(sourceName)) {
              map.removeSource(sourceName);
            }
          });
        }
        terraDrawInstance.clear();
        data.forEach((zone: { coordinates: unknown; name: string; color: string }, idx: number) => {
          try {
            renderZonePolygon(map, terraDrawInstance, zone, idx);
          } catch (err) {
            console.error(`Error al procesar la zona ${zone.name}:`, err);
          }
        });
      }
    } catch (err) {
      console.error("Error inesperado al recargar zonas:", err);
    }
  }, [terraDrawInstance]);

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

      const { error } = await supabase.from("zones").insert({
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
        // --- INICIO CAMBIO: recargar zonas sin cambiar pestaña ---
        await reloadZonesOnMap();
        // --- FIN CAMBIO ---
      }
    } catch (err) {
      console.error("Error inesperado al guardar zonas como puntos GeoJSON:", err);
    }
  }, [zoneName, zoneColor, reloadZonesOnMap]);

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
          const mapboxAdapter = new TerraDrawMapboxGLAdapter({ map });

          const terraDraw = new TerraDraw({
            adapter: mapboxAdapter,
            modes: [
              new TerraDrawPolygonMode(),
              new TerraDrawLineStringMode(),
              new TerraDrawPointMode(),
              new TerraDrawCircleMode(),
              new TerraDrawRectangleMode(),
              new TerraDrawSelectMode(),
            ],
          });

          terraDraw.start();
          setTerraDrawInstance(terraDraw);
          mapInstanceRef.current = map;

          // Cargar zonas desde Supabase y dibujarlas en el mapa tras inicialización
          (async () => {
            const { data, error } = await supabase.from("zones").select("coordinates, name, color");
            if (error) {
              console.error("Error al cargar zonas desde Supabase:", error.message);
              return;
            }
            if (data && mapInstanceRef.current && terraDraw) {
              // Limpiar capas y fuentes existentes
              const map = mapInstanceRef.current;
              const style = map.getStyle();
              if (style && style.layers) {
                style.layers.forEach((layer) => {
                  if (layer.type === 'fill' && map.getLayer(layer.id)) {
                    map.removeLayer(layer.id);
                  }
                });
                Object.keys(style.sources).forEach((sourceName) => {
                  if (map.getSource(sourceName)) {
                    map.removeSource(sourceName);
                  }
                });
              }
              terraDraw.clear();
              data.forEach((zone: { coordinates: unknown; name: string; color: string }, idx: number) => {
                try {
                  renderZonePolygon(map, terraDraw, zone, idx);
                } catch (err) {
                  console.error(`Error al procesar la zona ${zone.name}:`, err);
                }
              });
            }
          })();
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
  }, [activeTab, handleDrawZones, terraDrawInstance]);

  useEffect(() => {
    if (terraDrawInstance && selectedTool) {
      try {
        // Los modos select y edit deben estar en minúsculas
        terraDrawInstance.setMode(selectedTool.toLowerCase());
      } catch (error) {
        console.error(`Error al cambiar el modo de dibujo a ${selectedTool}:`, error);
      }
    }
  }, [selectedTool, terraDrawInstance]);

  // Agregar efecto para cargar zonas desde Supabase y mostrarlas en el mapa
  useEffect(() => {
    let styleLoadListener: (() => void) | null = null;
    const fetchZones = async () => {
      try {
        const { data, error } = await supabase.from("zones").select("coordinates, name, color");
        if (error) {
          console.error("Error al cargar zonas desde Supabase:", error.message);
          return;
        }
        if (data && mapInstanceRef.current && terraDrawInstance) {
          const map = mapInstanceRef.current;
          const style = map.getStyle();
          if (style && style.layers) {
            // Eliminar capas
            map.getStyle().layers.forEach((layer) => {
              if (layer.type === 'fill' && map.getLayer(layer.id)) {
                map.removeLayer(layer.id);
              }
            });
            // Eliminar fuentes
            Object.keys(map.getStyle().sources).forEach((sourceName) => {
              if (sourceName && map.getSource(sourceName)) {
                map.removeSource(sourceName);
              }
            });
          }
          terraDrawInstance.clear();
          data.forEach((zone: { coordinates: unknown; name: string; color: string }, idx: number) => {
            try {
              renderZonePolygon(map, terraDrawInstance, zone, idx);
            } catch (err) {
              console.error(`Error al procesar la zona ${zone.name}:`, err);
            }
          });
        }
      } catch (err) {
        console.error("Error inesperado al cargar zonas desde Supabase:", err);
      }
    };

    if (activeTab === "mapa" && mapInstanceRef.current) {
      // Escuchar el evento style.load para asegurar que el mapa esté listo
      const map = mapInstanceRef.current;
      styleLoadListener = () => {
        fetchZones();
      };
      map.on("style.load", styleLoadListener);
      // Si el estilo ya está cargado, cargar zonas inmediatamente
      if (map.isStyleLoaded()) {
        fetchZones();
      }
    }
    return () => {
      if (mapInstanceRef.current && styleLoadListener) {
        mapInstanceRef.current.off("style.load", styleLoadListener);
      }
    };
  }, [activeTab, terraDrawInstance]);

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
          
          {/* Filtros de usuarios */}
          <div className="mb-4">
            <h3 className="text-md font-medium mb-2">Filtrar por rol:</h3>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setUserFilter("todos")}
                className={`px-3 py-1 text-sm rounded-lg font-semibold transition-all ${
                  userFilter === "todos" 
                    ? "bg-blue-600 text-white" 
                    : "bg-gray-200 text-gray-800 hover:bg-gray-300"
                }`}
              >
                Todos
              </button>
              <button
                onClick={() => setUserFilter("admin")}
                className={`px-3 py-1 text-sm rounded-lg font-semibold transition-all ${
                  userFilter === "admin" 
                    ? "bg-blue-700 text-white" 
                    : "bg-gray-200 text-gray-800 hover:bg-gray-300"
                }`}
              >
                Administradores
              </button>
              <button
                onClick={() => setUserFilter("recycler")}
                className={`px-3 py-1 text-sm rounded-lg font-semibold transition-all ${
                  userFilter === "recycler" 
                    ? "bg-blue-600 text-white" 
                    : "bg-gray-200 text-gray-800 hover:bg-gray-300"
                }`}
              >
                Dirigentes
              </button>
              <button
                onClick={() => setUserFilter("resident")}
                className={`px-3 py-1 text-sm rounded-lg font-semibold transition-all ${
                  userFilter === "resident" 
                    ? "bg-orange-600 text-white" 
                    : "bg-gray-200 text-gray-800 hover:bg-gray-300"
                }`}
              >
                Referentes
              </button>
            </div>
          </div>
          
          {filteredUsers.length === 0 ? (
            <p className="text-gray-500">No hay usuarios que coincidan con el filtro seleccionado.</p>
          ) : (
            <div className="bg-white shadow rounded-lg p-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {filteredUsers.map(user => (
                  <div key={user.id} className="border rounded-lg p-4 flex flex-col sm:flex-row items-start sm:items-center space-x-4">
                    <img src={getAvatarUrl(user.avatar_url, user.name)} alt={user.name || 'Usuario'} className="w-16 h-16 rounded-full object-cover" />
                    <div className="flex-1 min-w-0">
                      <p className="text-lg font-semibold truncate">{user.name}</p>
                      <p className="text-sm text-gray-500 truncate">{user.email}</p>
                      <p className="text-sm font-medium" style={{ color: user.role === 'admin' ? 'blue' : user.role === 'recycler' ? 'blue' : user.role === 'resident_institutional' ? 'purple' : 'orange' }}>
                        {user.role === 'admin' ? 'Administrador' : user.role === 'recycler' ? 'Reciclador' : user.role === 'resident_institutional' ? 'Dirigente Institucional' : 'Dirigente'}
                      </p>
                      {user.role === 'resident' && (
                        <div className="mt-2">
                          <h4 className="text-sm font-semibold">Centros de Movilizaciòn:</h4>
                          <ul className="list-disc pl-5">
                            {collectionPoints.filter(point => point.user_id === user.user_id).map(point => (
                              <li key={point.id}>{point.location}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {user.role === 'resident_institutional' && (
                        <div className="mt-2">
                          <h4 className="text-sm font-semibold">Punto Colectivo:</h4>
                          <ul className="list-disc pl-5">
                            {collectionPoints.filter(point => point.user_id === user.user_id).map(point => (
                              <li key={point.id}>{point.address}</li>
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
                      {(user.role === 'resident' || user.role === 'resident_institutional') && (
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
          
          {/* Sistema de Notificaciones Avanzado */}
          <div className="bg-white shadow rounded-lg p-4">
            <NotificationManager />
          </div>
          
          {/* Sistema de Notificaciones Tradicional */}
          <div className="mt-8">
            <h3 className="text-lg font-semibold mb-4">Notificaciones por Base de Datos</h3>
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
                    onClick={() => setNotifType('Dirigentes')}
                    className={`px-4 py-2 rounded-lg font-semibold transition-all flex items-center space-x-2 ${notifType === 'Dirigentes' ? 'bg-blue-800 text-white' : 'bg-blue-600 text-gray-200'}`}
                  >
                    <span>Dirigentes</span>
                  </button>
                  <button
                    onClick={() => setNotifType('Referentes')}
                    className={`px-4 py-2 rounded-lg font-semibold transition-all flex items-center space-x-2 ${notifType === 'Referentes' ? 'bg-orange-800 text-white' : 'bg-orange-600 text-gray-200'}`}
                  >
                    <span>Referentes</span>
                  </button>
                </div>
                <div className="mt-4">
                  <p className="text-sm text-gray-700 font-semibold">Destinatario seleccionado: <span className="text-blue-600">{notifType}</span></p>
                  
                  {notifType && notifType !== 'Individual' && (
                    <button
                      type="button"
                      onClick={() => {
                        // Filtrar usuarios según el tipo seleccionado
                        let filteredUsers = users;
                        if (notifType === 'Dirigentes') {
                          filteredUsers = users.filter(user => user.role === 'recycler');
                        } else if (notifType === 'Referentes') {
                          filteredUsers = users.filter(user => user.role === 'resident');
                        }
                        
                        // Extraer y copiar los emails al portapapeles
                        const emails = extractEmails(filteredUsers);
                        navigator.clipboard.writeText(emails)
                          .then(() => alert('Correos copiados al portapapeles'))
                          .catch(err => console.error('Error al copiar:', err));
                      }}
                      className="mt-2 px-3 py-1 text-sm rounded-lg bg-gray-200 text-gray-700 hover:bg-gray-300 transition-colors"
                    >
                      Copiar lista de emails
                    </button>
                  )}
                </div>
                
                {/* Opciones de correo electrónico */}
                <div className="mt-6 border-t pt-4">
                  <h3 className="text-lg font-semibold mb-4">Opciones de correo electrónico</h3>
                  
                  <div className="flex items-center mb-4">
                    <input
                      type="checkbox"
                      id="send-email"
                      checked={sendEmail}
                      onChange={(e) => setSendEmail(e.target.checked)}
                      className="h-5 w-5 text-blue-600 rounded"
                      disabled={emailServiceStatus !== 'available'}
                    />
                    <label htmlFor="send-email" className="ml-2 text-gray-700">
                      También enviar por correo electrónico
                      {emailServiceStatus !== 'available' && (
                        <span className="ml-2 text-xs text-red-600">
                          (Servicio de correo no disponible)
                        </span>
                      )}
                    </label>
                  </div>
                  
                  {sendEmail && (
                    <div className="space-y-4 bg-gray-50 p-4 rounded-lg">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Texto del botón (opcional)
                        </label>
                        <input
                          type="text"
                          value={emailButtonText}
                          onChange={(e) => setEmailButtonText(e.target.value)}
                          placeholder="Ej: Ver más información"
                          className="block w-full px-3 py-2 border rounded-lg"
                        />
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          URL del botón (opcional)
                        </label>
                        <input
                          type="url"
                          value={emailButtonUrl}
                          onChange={(e) => setEmailButtonUrl(e.target.value)}
                          placeholder="https://econecta.app/noticias"
                          className="block w-full px-3 py-2 border rounded-lg"
                        />
                        <p className="text-xs text-gray-500 mt-1">
                          Si proporciona una URL y un texto, se añadirá un botón al correo.
                        </p>
                      </div>
                    </div>
                  )}
                </div>
                
                <div className="mt-6">
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-lg bg-blue-600 text-white font-semibold transition-all flex items-center space-x-2"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12H9m6 4H9m6-8H9m6 4H9m6-8H9" />
                    </svg>
                    <span>Enviar {sendEmail ? 'notificación y correo' : 'notificación'}</span>
                  </button>
                </div>
              </div>
            </form>
          </div>
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
            {[
              "Polygon",
              "LineString",
              "Point",
              "Circle",
              "Rectangle",
              "Select",
              "Edit",
            ].map((tool) => (
              <button
                key={tool}
                onClick={() => setSelectedTool(tool === "Edit" ? "Select" : tool)}
                className={`px-4 py-2 rounded-lg font-semibold transition-all ${selectedTool === tool || (tool === "Edit" && selectedTool === "Select") ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-800"}`}
              >
                {tool}
              </button>
            ))}
          </div>
          <div className="flex space-x-4 mb-4">
            <button
              onClick={async () => {
                if (terraDrawInstance && mapInstanceRef.current) {
                  // Solo borrar features que existen en TerraDraw
                  const allFeatures = terraDrawInstance.getSnapshot();
                  const allIds = allFeatures.map((f: Feature) => f.id as string);
                  const selectedFeatureIds = terraDrawInstance.getFeatureId();
                  const featureIdsArray = Array.isArray(selectedFeatureIds) ? selectedFeatureIds : [selectedFeatureIds];
                  // Filtrar solo los IDs que existen en TerraDraw
                  const validIds = featureIdsArray.filter((id) => allIds.includes(id));
                  if (validIds.length > 0) {
                    terraDrawInstance.removeFeatures(validIds);
                  }
                  // Borrar de la base de datos aunque no existan en TerraDraw (por si el usuario quiere borrar zonas persistidas)
                  if (featureIdsArray.length > 0) {
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
          <div className="flex flex-col sm:flex-row sm:items-start gap-4">
            <div className="flex-1">
              <p><span className="font-semibold">Nombre:</span> {selectedUser.name}</p>
              <p><span className="font-semibold">Email:</span> {selectedUser.email}</p>
              <p><span className="font-semibold">Rol:</span> {selectedUser.role}</p>
              {/* Otros detalles relevantes */}
            </div>
            <div className="flex flex-col gap-2">
              <button onClick={() => setSelectedUser(null)} className="px-3 py-1 rounded-lg bg-blue-600 text-white">Cerrar</button>
            </div>
          </div>
        </div>
      )}
      {showModal && (
        <div className="fixed inset-0 bg-gray-800 bg-opacity-50 flex items-center justify-center">
          <div className="bg-white rounded-lg p-6 w-96">
            <h3 className="text-lg font-semibold mb-4">Seleccionar Usuario</h3>
            <ul className="space-y-2">
              {users.map((user: UserRow) => (
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
            <h3 className="text-lg font-semibold mb-4">Centros de Movilizaciòn</h3>
            {residentPoints.length === 0 ? (
              <p className="text-sm text-gray-500">No hay Centros de Movilizaciòn creados por este Dirigente.</p>
            ) : (
              <ul className="space-y-2">
                {residentPoints.map((point: CollectionPoint) => (
                  <li key={point.id} className="flex items-center justify-between p-1 border rounded-lg text-sm">
                    <span className="truncate w-4/5 h-6">{point.address}</span>
                    <select
                      onChange={e => setSelectedRecycler(users.find((user: UserRow) => user.id === e.target.value) || null)}
                      className="px-0.5 py-2 text-xs rounded-lg border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-600 w-1/5"
                    >
                      <option value="">--Reciclador--</option>
                      {users.filter((user: UserRow) => user.role === 'recycler').map((recycler: UserRow) => (
                        <option key={recycler.id} value={recycler.id}>{recycler.name}</option>
                      ))}
                    </select>
                    <button
                      onClick={() => selectedRecycler && handleAssignPoint(selectedRecycler.id, point.id)}
                      className="px-2 py-1 text-xs rounded-lg bg-blue-600 text-white font-semibold"
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
