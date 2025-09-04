import { createClient } from '@supabase/supabase-js';
import { ReactNode } from 'react';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Set con las tablas detectadas como existentes en la base de datos.
// Se poblará durante la inicialización para evitar pings repetidos a tablas inexistentes
export const existingTables = new Set<string>();

// Logs de diagnóstico (seguros: solo mostramos prefijos, nunca claves completas)
try {
  console.log('Supabase URL (masked):', supabaseUrl ? supabaseUrl.replace(/(https?:\/\/)([^.]+)(.*)/, '$1$2...') : 'MISSING');
  if (supabaseAnonKey) {
    console.log('Supabase anon key prefix:', supabaseAnonKey.substring(0, 10) + '...');
  } else {
    console.warn('Supabase anon key missing');
  }
} catch {
  // No bloquear la ejecución por logs
}

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
      // Usar la forma recomendada para obtener cuenta sin solicitar datos en el body
      const { error: pingError } = await supabase.from('profiles').select('*', { count: 'exact', head: true }).limit(1);
      
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
  // Evitamos hacer un ping proactivo a `concentration_claims` durante la
  // inicialización porque muchas instalaciones no tienen esa migración y
  // provoca errores 400/404 recurrentes en logs. Las consultas a esa tabla
  // deberán comprobar existencia con `checkTableExists` antes de ejecutarse.
  const tables = ['profiles', 'concentration_points'];
    const missingTables: string[] = [];
    for (const table of tables) {
      try {
        // Hacemos un ping mínimo a la tabla usando el count en los headers
        const { error: tableError } = await supabase
          .from(table)
          .select('*', { count: 'exact', head: true })
          .limit(1);

        if (tableError) {
          // Si la tabla no existe, la marcamos como ausente pero no spammeamos la consola
          if (tableError.code === '42P01') {
            missingTables.push(table);
          } else {
            console.warn(`Error al acceder a la tabla ${table}:`, tableError?.message || tableError);
          }
        } else {
          existingTables.add(table);
          console.log(`Tabla ${table} accesible correctamente`);
        }
      } catch (tableErr) {
        console.warn(`Error al intentar acceder a la tabla ${table}:`, tableErr);
      }
    }

    if (missingTables.length > 0) {
      console.warn('Las siguientes tablas no están disponibles en la base de datos:', missingTables.join(', '));
      console.warn('Consulta los archivos SQL en `supabase/migrations` o `sql/` para crear las tablas necesarias si corresponde.');
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
    // Si ya detectamos tablas durante initializeSupabase, usamos ese cache para evitar nuevas consultas REST
    if (existingTables.size > 0) {
      return existingTables.has(tableName);
    }
    // Método directo: intentar hacer una consulta mínima a la tabla
    const { error } = await supabase
      .from(tableName)
      .select('*', { count: 'exact', head: true })
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
  // Tipos de usuario: se incluyen variantes históricas y el tipo 'fiscal'
  // 'resident' -> vecino/dirigente, 'recycler' -> referente/dirigente técnico
  // 'resident_institutional' se mantuvo para compatibilidad con migraciones antiguas
  type: 'resident' | 'recycler' | 'fiscal' | 'resident_institutional';
  avatar_url?: string;
  online?: boolean;
  materials?: string[];
  bio?: string;
  experience_years?: number;
  service_areas?: string[];
  dni?: string; // <-- Agregado para permitir el uso de dni
}

export type concentrationPoint = {
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
  // claim fields removed from client - DB may still have claim-related columns but client no longer uses them
  // claim_id?: string | null;
  // claim_status?: string;
  pickup_time?: string | null;
  pickup_extra?: string | null; // Nuevo campo agregado
  type?: string; // <-- Añadido para distinguir puntos colectivos
  photo_url?: string | null;
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

export interface concentrationClaim {
  id: string;
  concentration_point_id: string;
  recycler_id: string;
  status: 'claimed' | 'completed' | 'cancelled' | 'failed';
  claimed_at: string;
  completed_at?: string;
  cancelled_at?: string;
  cancellation_reason?: string;
  cancelled_by?: string;
  pickup_time?: string; // Added for countdown timer
}
// NOTE: The concentration_claims feature was removed from the client.
// We keep stubs for the old functions so callers fail-fast with a clear message.
const CLAIMS_REMOVED_MESSAGE = 'La funcionalidad de "claims" ha sido eliminada del cliente. Contacta al administrador si necesitas restaurarla.';

export async function signUpUser(email: string, password: string, userData: Partial<User> & { dni?: string }) {
  try {
  // Intenta crear el usuario en Auth
  console.log('[signUpUser] inicio', { email, role: userData.type, hasDni: !!userData.dni });
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

    console.log('[signUpUser] auth created, user id:', authData.user.id);

    // Si no hay sesión (por ejemplo cuando se requiere confirmación por email),
    // authData.session puede ser null. En ese caso no intentamos operaciones que
    // requieran privilegios adicionales y devolvemos info útil al llamador.
    if (!authData.session) {
      console.log('[signUpUser] No session returned (email confirmation may be required). Returning early.');
      return { data: { ...authData, profile: null }, error: null };
    }

    // Verifica si ya existe un perfil por user_id
    const { data: profileById } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', authData.user.id)
      .maybeSingle();
    if (profileById) {
  console.log('[signUpUser] perfil ya existe por user_id, retornando');
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
        console.log('[signUpUser] perfil encontrado por email, actualizando user_id');
        await supabase.from('profiles').update({ user_id: authData.user.id }).eq('email', email);
      }
      return { data: { ...authData, profile: { ...profileByEmail, user_id: authData.user.id } }, error: null };
    }

    // Si no existe, crea el perfil
    console.log('[signUpUser] Intentando crear perfil en table profiles');
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
      // Si hay un error RLS, devolvemos un mensaje más claro
      if (profileError && profileError.code === '42501') {
        console.error('[signUpUser] RLS denied insert into profiles:', profileError);
        return { data: null, error: new Error('Row-level security prevented profile creation. Ensure RLS policies allow inserts for authenticated users or run profile creation from a privileged backend.') };
      }
      console.error('[signUpUser] Error al crear perfil:', profileError);
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
  console.log('[signInUser] intento de inicio de sesión', { email });
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

  console.log('[signInUser] sign in exitoso, user id:', authData.user.id);

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

export async function claimconcentrationPoint(
): Promise<void> {
  // Stub implementation: feature removed
  throw new Error(CLAIMS_REMOVED_MESSAGE);
}

export async function cancelClaim(
): Promise<void> {
  // Stub implementation: feature removed
  throw new Error(CLAIMS_REMOVED_MESSAGE);
}

export async function completeconcentration(
): Promise<void> {
  // Stub implementation: feature removed
  throw new Error(CLAIMS_REMOVED_MESSAGE);
}

export async function deleteconcentrationPoint(pointId: string, userId: string): Promise<void> {
  try {
    const { error } = await supabase
      .from('concentration_points')
      .delete()
      .eq('id', pointId)
      .eq('user_id', userId);

    if (error) {
      throw error;
    }
  } catch (error) {
    console.error('Error deleting concentration point:', error);
    throw error;
  }
}

export async function ensureUserProfile({ id, email, name }: { id: string; email: string; name: string; }): Promise<void> {
  try {
    // Verifica si el perfil ya existe
    const { data, error } = await supabase
      .from('profiles')
      // La tabla usa user_id como PK; devolvemos user_id como id para mantener compatibilidad
  .select('user_id')
      .eq('user_id', id)
      .maybeSingle();

  if (!data && !error) {
      // Si no existe, lo crea
      // Insertamos siempre con user_id explícito (evita que el DEFAULT gen_random_uuid() cree un valor distinto)
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
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function cleanupOldCancelledClaims(_olderThanHours: number = 24): Promise<{ deleted: number; error?: string }> {
  // Stub implementation: feature removed
  console.warn('cleanupOldCancelledClaims called but claims feature was removed. No action taken.');
  return { deleted: 0 };
}

// Función para obtener estadísticas de claims para debugging
export async function getClaimsStats(): Promise<{ 
  total: number; 
  claimed: number; 
  completed: number; 
  cancelled: number; 
  byPoint: Record<string, number>;
}> {
  // Stub implementation: feature removed
  return { total: 0, claimed: 0, completed: 0, cancelled: 0, byPoint: {} };
}
