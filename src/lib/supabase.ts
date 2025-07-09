import { createClient } from '@supabase/supabase-js';
import { ReactNode } from 'react';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Función para verificar la configuración de Supabase e inicializar recursos necesarios
export async function initializeSupabase(): Promise<boolean> {
  try {
    // Verificar que la URL y la clave de Supabase estén definidas correctamente
    if (!supabaseUrl || !supabaseAnonKey) {
      console.error('Variables de entorno de Supabase no configuradas correctamente:',
                    { url: !!supabaseUrl, key: !!supabaseAnonKey });
      return false;
    }
    
    console.log('Variables de entorno de Supabase verificadas');
    
    // 1. Verificar que podemos conectarnos a la base de datos
    const { error } = await supabase.auth.getSession();
    
    if (error) {
      console.error('Error al conectar con Supabase:', error);
      return false;
    }
    
    console.log('Conexión a Supabase establecida correctamente');
    
    // 2. Realizar una operación simple para verificar conectividad
    try {
      const { error: pingError } = await supabase.from('profiles').select('count(*)').limit(1);
      
      if (pingError) {
        if (pingError.code === '42P01') {
          console.error('La tabla "profiles" no existe en la base de datos.');
          console.log('Esto podría indicar un problema con la configuración de la base de datos.');
          console.log('URL de Supabase (parcial para seguridad):', 
                     supabaseUrl.substring(0, 10) + '...' + supabaseUrl.substring(supabaseUrl.length - 10));
          
          // Intentamos verificar si el usuario tiene permisos
          const { data: authData, error: authError } = await supabase.auth.getUser();
          if (authError) {
            console.error('Error al obtener información del usuario autenticado:', authError);
          } else {
            console.log('Usuario autenticado correctamente:', authData?.user ? 'Sí' : 'No');
          }
          
          // No bloqueamos la inicialización - a veces el error 42P01 es falso positivo
          return true;
        } else {
          console.error('Error al hacer ping a Supabase:', pingError);
          // Para otros errores, seguimos adelante
        }
      } else {
        console.log('Ping a Supabase exitoso, base de datos accesible');
      }
    } catch (pingError) {
      console.error('Error al hacer ping a Supabase:', pingError);
      // No bloqueamos por errores de ping
    }
    
    // Intentamos usar las tablas principales, pero no bloqueamos la inicialización
    // Esto nos ayuda a diagnosticar el problema
    const tables = ['profiles', 'collection_points', 'collection_claims'];
    for (const table of tables) {
      try {
        console.log(`Intentando acceder a la tabla ${table}...`);
        const { error: tableError } = await supabase
          .from(table)
          .select('count(*)')
          .limit(1);
          
        if (tableError) {
          if (tableError.code === '42P01') {
            console.warn(`La tabla ${table} no existe en la base de datos o no es accesible`);
          } else {
            console.warn(`Error al acceder a la tabla ${table}:`, tableError);
          }
        } else {
          console.log(`Tabla ${table} accesible correctamente`);
        }
      } catch (tableErr) {
        console.warn(`Error al intentar acceder a la tabla ${table}:`, tableErr);
      }
    }
    
    // Consideramos la inicialización exitosa incluso si hay problemas
    // para permitir que la aplicación intente funcionar
    return true;
  } catch (error) {
    console.error('Error al inicializar Supabase:', error);
    // Para errores realmente graves, devolvemos falso
    return false;
  }
}

// Función para verificar si existe una tabla
export async function checkTableExists(tableName: string): Promise<boolean> {
  try {
    // Método directo: intentar hacer una consulta mínima a la tabla
    const { error } = await supabase
      .from(tableName)
      .select('count(*)', { count: 'exact', head: true })
      .limit(1);
    
    // Si no hay error, la tabla existe
    if (error === null) {
      return true;
    }
    
    // Si el error es específicamente "relation does not exist", la tabla no existe
    if (error && error.code === '42P01') {
      console.log(`La tabla ${tableName} no existe`);
      return false;
    }
    
    // Si hay otro tipo de error, puede ser un problema de permisos u otra cosa
    // Intentamos otro método
    console.warn(`Error al verificar tabla ${tableName} con consulta count:`, error);
    
    // Método alternativo: intentar verificar los metadatos de la tabla
    try {
      const { error: metaError } = await supabase
        .from(tableName)
        .select('*')
        .limit(1);
      
      // Si no hay error en esta consulta alternativa, la tabla existe
      return metaError === null;
    } catch (innerError) {
      console.error(`Error secundario al verificar tabla ${tableName}:`, innerError);
      
      // Si todos los métodos fallan, asumimos que la tabla existe 
      // (es mejor asumir que existe y dejar que la operación real reporte el error específico)
      return true;
    }
  } catch (error) {
    console.error(`Error al verificar la tabla ${tableName}:`, error);
    // Por defecto, asumimos que la tabla existe para evitar bloqueos innecesarios
    return true;
  }
}

export interface User {
  role: string;
  user_id: string;
  id: string;
  name: string;
  email: string;
  phone?: string;
  address?: string;
  type: 'resident' | 'recycler' | 'resident_institutional';
  avatar_url?: string;
  online?: boolean;
  materials?: string[];
  bio?: string;
  experience_years?: number;
  service_areas?: string[];
  dni?: string; // <-- Agregado para permitir el uso de dni
}

export type CollectionPoint = {
  creator_dni: string | undefined;
  additional_info: unknown;
  user_id: string;
  recycler_id: string;
  lng: number;
  lat: number;
  estimated_weight: number;
  cancellation_reason: string | null;
  cancelled_at: string | null; // ISO date string or null if not cancelled
  completed_at: string | null; // ISO date string or null if not completed
  profiles: User;
  creator_email: string;
  creator_name: ReactNode;
  creator_avatar: string | undefined;
  claimed_by: string;
  id: string;
  address: string;
  district: string;
  materials: string[];
  schedule: string;
  status: string;
  claim_id?: string | null; // <-- usa claim_id
  claim_status?: string; // <-- Agregado para el estado real del claim
  pickup_time?: string | null;
  pickup_extra?: string | null; // Nuevo campo agregado
  type?: string; // <-- Añadido para distinguir puntos colectivos
  // otros campos...
};

export interface RecyclerProfile {
  online: boolean;
  id: string;
  user_id: string;
  materials: string[];
  service_areas: string[];
  bio?: string;
  experience_years?: number;
  rating_average: number;
  total_ratings: number;
  profiles: {
    name: string;
    email: string;
    phone?: string;
    avatar_url?: string;
  };
}

export interface CollectionClaim {
  id: string;
  collection_point_id: string;
  recycler_id: string;
  status: 'claimed' | 'completed' | 'cancelled' | 'failed';
  claimed_at: string;
  completed_at?: string;
  cancelled_at?: string;
  cancellation_reason?: string;
  cancelled_by?: string;
  pickup_time?: string; // Added for countdown timer
}

export async function signUpUser(email: string, password: string, userData: Partial<User> & { dni?: string }) {
  try {
    // Intenta crear el usuario en Auth
    const { data: authData, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          name: userData.name,
          type: userData.type,
        }
      }
    });

    if (signUpError) throw signUpError;
    if (!authData.user) throw new Error('Failed to create user');

    // Verifica si ya existe un perfil por user_id
    const { data: profileById } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', authData.user.id)
      .maybeSingle();
    if (profileById) {
      return { data: { ...authData, profile: profileById }, error: null };
    }

    // Verifica si ya existe un perfil por email
    const { data: profileByEmail } = await supabase
      .from('profiles')
      .select('*')
      .eq('email', email)
      .maybeSingle();
    if (profileByEmail) {
      // Si existe, actualiza el user_id si es necesario
      if (!profileByEmail.user_id) {
        await supabase.from('profiles').update({ user_id: authData.user.id }).eq('email', email);
      }
      return { data: { ...authData, profile: { ...profileByEmail, user_id: authData.user.id } }, error: null };
    }

    // Si no existe, crea el perfil
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .insert([{
        user_id: authData.user.id,
        email: email,
        name: userData.name,
        role: userData.type,
        dni: userData.dni, // dni is now explicitly typed
      }])
      .select()
      .single();

    if (profileError || !profile) {
      // Si falla la creación del perfil, elimina el usuario Auth
      await supabase.auth.admin.deleteUser(authData.user.id);
      throw profileError || new Error('Failed to create profile');
    }

    // Solo devuelve éxito si el perfil se creó correctamente
    return { data: { ...authData, profile }, error: null };
  } catch (error: unknown) {
    console.error('SignUp error:', error);
    return { data: null, error: error instanceof Error ? error : new Error(String(error)) };
  }
}

export async function signInUser(email: string, password: string) {
  try {
    // Sign in user
    const { data: authData, error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (signInError) {
      if (signInError.message === 'Invalid login credentials') {
        throw new Error('Invalid login credentials');
      }
      throw signInError;
    }

    if (!authData.user) throw new Error('Failed to sign in');

    // Get profile by user_id
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', authData.user.id)
      .maybeSingle();

    if (profileError) throw profileError;
    if (profile) {
      // Map role to type for consistency with the User interface
      return {
        data: authData,
        profile: { ...profile, type: profile.role }
      };
    }

    // Si no existe perfil por user_id, busca por email
    const { data: existingProfile, error: existingProfileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('email', authData.user.email)
      .maybeSingle();
    if (existingProfileError) throw existingProfileError;
    if (existingProfile) {
      // Si existe, actualiza el user_id si es necesario
      if (!existingProfile.user_id) {
        await supabase.from('profiles').update({ user_id: authData.user.id }).eq('email', authData.user.email);
      }
      return {
        data: authData,
        profile: { ...existingProfile, user_id: authData.user.id, type: existingProfile.role }
      };
    }

    // Si no existe ni por user_id ni por email, crea el perfil
    const { error: createProfileError } = await supabase
      .from('profiles')
      .insert([
        {
          user_id: authData.user.id,
          email: authData.user.email!,
          name: authData.user.user_metadata.name || '',
          role: authData.user.user_metadata.type || 'resident',
        }
      ]);

    if (createProfileError) {
      // Si la creación falla por restricción de unicidad, intenta recuperar el perfil existente
      if (createProfileError.code === '23505' || createProfileError.message?.includes('duplicate')) {
        const { data: conflictProfile } = await supabase
          .from('profiles')
          .select('*')
          .eq('email', authData.user.email)
          .maybeSingle();
        if (conflictProfile) {
          return {
            data: authData,
            profile: { ...conflictProfile, user_id: authData.user.id, type: conflictProfile.role }
          };
        }
      }
      throw new Error('Failed to create profile');
    }

    // Fetch the newly created profile
    const { data: newProfile, error: fetchError } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', authData.user.id)
      .single();

    if (fetchError || !newProfile) throw new Error('Failed to fetch profile');

    return {
      data: authData,
      profile: { ...newProfile, type: newProfile.role }
    };
  } catch (error: unknown) {
    console.error('SignIn error:', error);
    throw error;
  }
}

export async function claimCollectionPoint(
  pointId: string,
  recyclerId: string,
  pickupTime: string,
  userId: string // <-- nuevo parámetro obligatorio
): Promise<void> {
  try {
    console.log('Iniciando proceso de reclamación de punto', { pointId, recyclerId, userId });
    
    // Validar que los parámetros sean valores válidos
    if (!pointId || !recyclerId || !userId || !pickupTime) {
      throw new Error('Faltan parámetros requeridos para reclamar el punto');
    }
    
    // Validar que sean UUIDs válidos
    const isValidUuid = (id: string) => {
      return /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(id);
    };
    
    if (!isValidUuid(pointId) || !isValidUuid(recyclerId) || !isValidUuid(userId)) {
      throw new Error('Uno o más IDs no tienen formato UUID válido');
    }

    // Verificar si las tablas necesarias existen
    const claimsTableExists = await checkTableExists('collection_claims');
    const pointsTableExists = await checkTableExists('collection_points');
    
    if (!claimsTableExists) {
      console.error('ERROR CRÍTICO: La tabla collection_claims no existe');
      throw new Error('La tabla collection_claims no existe en la base de datos. Por favor contacta al administrador del sistema.');
    }
    
    if (!pointsTableExists) {
      console.error('ERROR CRÍTICO: La tabla collection_points no existe');
      throw new Error('La tabla collection_points no existe en la base de datos. Por favor contacta al administrador del sistema.');
    }

    // NUEVO: Verificar si existe un claim activo para este punto
    console.log('Verificando claims existentes para el punto:', pointId);
    const { data: existingClaims, error: checkError } = await supabase
      .from('collection_claims')
      .select('id, status, recycler_id, created_at')
      .eq('collection_point_id', pointId)
      .order('created_at', { ascending: false });

    if (checkError) {
      console.error('Error al verificar claims existentes:', checkError);
      throw new Error('Error al verificar el estado del punto de recolección');
    }

    // Si hay claims, verificar el estado del más reciente
    if (existingClaims && existingClaims.length > 0) {
      const latestClaim = existingClaims[0]; // El más reciente por el order
      console.log('Claim más reciente encontrado:', latestClaim);
      
      if (latestClaim.status === 'claimed') {
        throw new Error('Este punto ya ha sido reclamado por otro reciclador.');
      }
      
      if (latestClaim.status === 'completed') {
        throw new Error('Este punto ya ha sido completado y no está disponible.');
      }
      
      // Si está 'cancelled', eliminarlo para evitar conflictos con el constraint único
      if (latestClaim.status === 'cancelled') {
        console.log('Eliminando claim cancelado para permitir nueva reclamación');
        const { error: deleteError } = await supabase
          .from('collection_claims')
          .delete()
          .eq('id', latestClaim.id);
        
        if (deleteError) {
          console.error('Error al eliminar claim cancelado:', deleteError);
          throw new Error('Error al procesar claim cancelado anterior');
        }
        
        console.log('Claim cancelado eliminado exitosamente, procediendo con nueva reclamación');
      }
    }

    // Verificar que el punto esté disponible en collection_points
    console.log('Verificando estado del punto en collection_points');
    const { data: pointData, error: pointCheckError } = await supabase
      .from('collection_points')
      .select('id, status, user_id')
      .eq('id', pointId)
      .single();

    if (pointCheckError) {
      console.error('Error al verificar el punto:', pointCheckError);
      throw new Error('El punto de recolección no existe o no está disponible');
    }

    if (!pointData) {
      throw new Error('El punto de recolección no fue encontrado');
    }

    if (pointData.status !== 'available') {
      throw new Error(`El punto no está disponible (estado actual: ${pointData.status})`);
    }

    if (pointData.user_id !== userId) {
      throw new Error('El ID del usuario propietario no coincide');
    }

    // Crear el claim con status 'claimed'
    console.log('Insertando registro en collection_claims');
    const { data: claim, error: claimError } = await supabase
      .from('collection_claims')
      .insert([
        {
          collection_point_id: pointId,
          recycler_id: recyclerId,
          user_id: userId, // <-- importante para cumplir el constraint
          status: 'claimed',
          pickup_time: pickupTime
        }
      ])
      .select()
      .single();

    if (claimError) {
      // Manejar específicamente el error cuando la tabla no existe
      if (claimError.code === '42P01') {
        console.error('La tabla collection_claims no existe en la base de datos');
        throw new Error('La tabla collection_claims no existe en la base de datos. Por favor contacta al administrador del sistema.');
      }
      
      // Manejar error de duplicado/conflicto
      if (claimError.code === '23505') {
        console.error('Conflicto de clave única al insertar claim:', claimError);
        
        // Verificar si el conflicto es por un claim cancelado que no se pudo eliminar
        const { data: conflictingClaim } = await supabase
          .from('collection_claims')
          .select('id, status, recycler_id')
          .eq('collection_point_id', pointId)
          .order('created_at', { ascending: false })
          .limit(1);
        
        if (conflictingClaim && conflictingClaim.length > 0) {
          const claim = conflictingClaim[0];
          if (claim.status === 'cancelled') {
            throw new Error('Error interno: existe un claim cancelado que impide la nueva reclamación. Reintenta en unos momentos.');
          } else {
            throw new Error(`Este punto ya ha sido reclamado por otro reciclador (estado: ${claim.status}).`);
          }
        } else {
          throw new Error('Este punto ya ha sido reclamado por otro reciclador mientras procesabas tu solicitud.');
        }
      }
      
      // Manejar error de constraint de foreign key
      if (claimError.code === '23503') {
        console.error('Error de referencia de clave foránea:', claimError);
        throw new Error('Error de referencia en la base de datos. El punto puede haber sido eliminado.');
      }
      
      console.error('Error al insertar en collection_claims:', claimError);
      throw new Error(`Error al crear la reclamación: ${claimError.message || 'Error desconocido'}`);
    }

    if (!claim || !claim.id) {
      console.error('No se pudo obtener el ID del claim creado');
      throw new Error('Error al crear la reclamación: no se pudo obtener el ID de la reclamación');
    }

    console.log('Registro insertado correctamente en collection_claims:', claim);

    // Actualizar el punto de recolección
    console.log('Actualizando collection_points');
    const { error: updateError } = await supabase
      .from('collection_points')
      .update({
        status: 'claimed',
        claim_id: claim.id,
        pickup_time: pickupTime,
        recycler_id: recyclerId
      })
      .eq('id', pointId); // <-- CORRECTO: debe ser .eq('id', pointId)

    if (updateError) {
      // Manejar específicamente el error cuando la tabla no existe
      if (updateError.code === '42P01') {
        console.error('La tabla collection_points no existe en la base de datos');
        throw new Error('La tabla collection_points no existe en la base de datos. Por favor contacta al administrador del sistema.');
      }
      
      console.error('Error al actualizar collection_points:', updateError);
      throw updateError;
    }
    
    console.log('Punto de recolección actualizado correctamente');

  } catch (error) {
    console.error('Error claiming collection point:', error);
    throw error;
  }
}

export async function cancelClaim(
  claimId: string, pointId: string, reason: string): Promise<void> {
  try {
    // Verificar si las tablas necesarias existen
    const claimsTableExists = await checkTableExists('collection_claims');
    const pointsTableExists = await checkTableExists('collection_points');
    
    if (!claimsTableExists) {
      console.error('ERROR CRÍTICO: La tabla collection_claims no existe');
      throw new Error('La tabla collection_claims no existe en la base de datos. Por favor contacta al administrador del sistema.');
    }
    
    if (!pointsTableExists) {
      console.error('ERROR CRÍTICO: La tabla collection_points no existe');
      throw new Error('La tabla collection_points no existe en la base de datos. Por favor contacta al administrador del sistema.');
    }
    
    // Update claim status
    const { error: claimError } = await supabase
      .from('collection_claims')
      .update({
        status: 'cancelled',
        cancelled_at: new Date().toISOString(),
        cancellation_reason: reason
      })
      .eq('id', claimId);

    if (claimError) throw claimError;

    // Update collection point status
    const { error: pointError } = await supabase
      .from('collection_points')
      .update({
        status: 'available',
        claim_id: null,
        pickup_time: null,
        recycler_id: null
      })
      .eq('id', pointId);

    if (pointError) throw pointError;

  } catch (error) {
    console.error('Error cancelling claim:', error);
    throw error;
  }
}

export async function completeCollection(
  claimId: string,
  pointId: string
): Promise<void> {
  try {
    // Verificar si las tablas necesarias existen
    const claimsTableExists = await checkTableExists('collection_claims');
    const pointsTableExists = await checkTableExists('collection_points');
    const profilesTableExists = await checkTableExists('profiles');
    const notificationsTableExists = await checkTableExists('notifications');
    
    if (!claimsTableExists || !pointsTableExists || !profilesTableExists) {
      const missingTables = [];
      if (!claimsTableExists) missingTables.push('collection_claims');
      if (!pointsTableExists) missingTables.push('collection_points');
      if (!profilesTableExists) missingTables.push('profiles');
      
      console.error(`ERROR CRÍTICO: Las siguientes tablas no existen: ${missingTables.join(', ')}`);
      throw new Error(`Una o más tablas requeridas no existen: ${missingTables.join(', ')}. Por favor contacta al administrador del sistema.`);
    }

    // Update claim status
    const { error: claimError } = await supabase
      .from('collection_claims')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString()
      })
      .eq('id', claimId);

    if (claimError) throw claimError;

    // Update collection point status
    const { error: pointError } = await supabase
      .from('collection_points')
      .update({
        status: 'completed'
      })
      .eq('id', pointId);

    if (pointError) throw pointError;

    // Get resident ID
    const { data: point, error: pointFetchError } = await supabase
      .from('collection_points')
      .select('user_id')
      .eq('id', pointId)
      .single();

    if (pointFetchError) throw pointFetchError;

    // DEBUG: Mostrar el user_id del residente
    console.log('[DEBUG completeCollection] user_id del residente:', point.user_id);

    // Sumar 10 EcoCreditos al residente
    const { data: currentProfile, error: profileError } = await supabase
      .from('profiles')
      .select('eco_creditos, user_id')
      .eq('user_id', point.user_id)
      .single();
    if (profileError) throw profileError;
    console.log('[DEBUG completeCollection] eco_creditos actuales:', currentProfile?.eco_creditos, 'user_id:', currentProfile?.user_id);
    const nuevosCreditos = (currentProfile?.eco_creditos || 0) + 10;
    const { error: updateError } = await supabase
      .from('profiles')
      .update({ eco_creditos: nuevosCreditos })
      .eq('user_id', point.user_id);
    if (updateError) throw updateError;
    console.log('[DEBUG completeCollection] eco_creditos nuevos:', nuevosCreditos);

    // Crear notificación para el residente si la tabla existe
    if (notificationsTableExists) {
      const { error: notificationError } = await supabase
        .from('notifications')
        .insert([{
          user_id: point.user_id,
          title: 'Recolección Completada',
          content: 'Tu punto de recolección ha sido completado exitosamente. Has ganado 10 EcoCreditos.',
          type: 'collection_completed',
          related_id: pointId
        }]);
  
      if (notificationError) {
        // No falla la función principal si hay error en notificaciones
        console.warn('No se pudo crear la notificación, pero la recolección se completó:', notificationError);
      }
    } else {
      console.warn('La tabla notifications no existe, no se creará notificación');
    }

    // Fin de función
    return;
  } catch (error) {
    console.error('Error completing collection:', error);
    throw error;
  }
}

export async function deleteCollectionPoint(pointId: string, userId: string): Promise<void> {
  try {
    const { error } = await supabase
      .from('collection_points')
      .delete()
      .eq('id', pointId)
      .eq('user_id', userId);

    if (error) {
      throw error;
    }
  } catch (error) {
    console.error('Error deleting collection point:', error);
    throw error;
  }
}

export async function ensureUserProfile({ id, email, name }: { id: string; email: string; name: string; }): Promise<void> {
  try {
    // Verifica si el perfil ya existe
    const { data, error } = await supabase
      .from('profiles')
      .select('id')
      .eq('user_id', id)
      .maybeSingle();

    if (!data && !error) {
      // Si no existe, lo crea
      await supabase.from('profiles').insert({
        user_id: id,
        email,
        name,
      });
    }
    // Si hay error, lo ignora aquí porque se maneja en el llamador
  } catch (error) {
    console.error('Error al asegurar el perfil de usuario:', error);
  }
}

// Función de mantenimiento: limpiar claims cancelados antiguos
export async function cleanupOldCancelledClaims(olderThanHours: number = 24): Promise<{ deleted: number; error?: string }> {
  try {
    const cutoffDate = new Date();
    cutoffDate.setHours(cutoffDate.getHours() - olderThanHours);
    
    console.log(`Limpiando claims cancelados anteriores a: ${cutoffDate.toISOString()}`);
    
    const { data, error } = await supabase
      .from('collection_claims')
      .delete()
      .eq('status', 'cancelled')
      .lt('cancelled_at', cutoffDate.toISOString())
      .select('id');
    
    if (error) {
      console.error('Error al limpiar claims cancelados:', error);
      return { deleted: 0, error: error.message };
    }
    
    const deletedCount = data?.length || 0;
    console.log(`Claims cancelados eliminados: ${deletedCount}`);
    
    return { deleted: deletedCount };
  } catch (err) {
    console.error('Error en cleanupOldCancelledClaims:', err);
    return { deleted: 0, error: (err as Error).message };
  }
}

// Función para obtener estadísticas de claims para debugging
export async function getClaimsStats(): Promise<{ 
  total: number; 
  claimed: number; 
  completed: number; 
  cancelled: number; 
  byPoint: Record<string, number>;
}> {
  try {
    const { data: claims, error } = await supabase
      .from('collection_claims')
      .select('collection_point_id, status');
    
    if (error) throw error;
    
    const stats = {
      total: claims?.length || 0,
      claimed: 0,
      completed: 0,
      cancelled: 0,
      byPoint: {} as Record<string, number>
    };
    
    claims?.forEach(claim => {
      switch (claim.status) {
        case 'claimed': stats.claimed++; break;
        case 'completed': stats.completed++; break;
        case 'cancelled': stats.cancelled++; break;
      }
      
      stats.byPoint[claim.collection_point_id] = (stats.byPoint[claim.collection_point_id] || 0) + 1;
    });
    
    return stats;
  } catch (err) {
    console.error('Error al obtener estadísticas de claims:', err);
    return { total: 0, claimed: 0, completed: 0, cancelled: 0, byPoint: {} };
  }
}
