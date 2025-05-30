import { createClient } from '@supabase/supabase-js';
import { ReactNode } from 'react';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export interface User {
  id: string;
  name: string;
  email: string;
  phone?: string;
  address?: string;
  type: 'resident' | 'recycler';
  avatar_url?: string;
  online?: boolean;
  materials?: string[];
  bio?: string;
  experience_years?: number;
  service_areas?: string[];
}

export type CollectionPoint = {
  additional_info: unknown;
  user_id: string;
  recycler_id: string;
  lng: number;
  lat: unknown;
  estimated_weight: number;
  cancellation_reason: string | null;
  cancelled_at: string | null; // ISO date string or null if not cancelled
  completed_at: string | null; // ISO date string or null if not completed
  profiles: User;
  creator_email: string;
  creator_name: ReactNode;
  creator_avatar: string | undefined;
  claimed_by: string;
  longitude: number;
  latitude: unknown;
  id: string;
  address: string;
  district: string;
  materials: string[];
  schedule: string;
  status: string;
  claim_id?: string | null; // <-- usa claim_id
  pickup_time?: string | null;
  pickup_extra?: string | null; // Nuevo campo agregado
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
  status: 'pending' | 'completed' | 'cancelled' | 'failed';
  claimed_at: string;
  completed_at?: string;
  cancelled_at?: string;
  cancellation_reason?: string;
  cancelled_by?: string;
  pickup_time?: string; // Added for countdown timer
}

export async function signUpUser(email: string, password: string, userData: Partial<User>) {
  try {
    // Elimina esta validación previa:
    // const { data: existingProfile } = await supabase
    //   .from('profiles')
    //   .select('id')
    //   .eq('email', email)
    //   .maybeSingle();
    // if (existingProfile) {
    //   return { data: null, error: new Error('User already registered') };
    // }

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

    // Si no hay sesión activa, probablemente el usuario debe confirmar su email
    const session = authData.session || (await supabase.auth.getSession()).data.session;
    if (!session) {
      return {
        data: authData,
        error: new Error('Registro exitoso. Por favor, confirma tu correo electrónico antes de iniciar sesión.')
      };
    }

    // Crea el perfil solo si el usuario fue creado en Auth y la sesión está activa
    const { error: profileError } = await supabase
      .from('profiles')
      .insert([{
        user_id: authData.user.id,
        email: email,
        name: userData.name,
        role: userData.type,
      }]);

    if (profileError) {
      throw profileError;
    }

    return { data: authData, error: null };
  } catch (error) {
    return { data: null, error: error instanceof Error ? error : new Error('Unknown error') };
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

    // Get profile
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', authData.user.id)
      .maybeSingle();

    if (profileError) throw profileError;
    if (!profile) {
      throw new Error('Profile not found. Please contact support.');
    }

    // Map role a type y role para el UserContext
    return {
      data: authData,
      profile: { ...profile, type: profile.role, role: profile.role }
    };
  } catch (error: unknown) {
    console.error('SignIn error:', error);
    throw error;
  }
}

export async function cancelClaim(claimId: string, pointId: string, userId: string, reason: string) {
  // Cancela el reclamo y actualiza el punto
  // 1. Actualiza el estado del claim a 'cancelled' y guarda el motivo
  const { error: claimError } = await supabase
    .from('collection_claims')
    .update({ status: 'cancelled', cancellation_reason: reason, cancelled_at: new Date().toISOString(), cancelled_by: userId })
    .eq('id', claimId);
  if (claimError) throw claimError;

  // 2. Actualiza el punto para dejarlo disponible nuevamente
  const { error: pointError } = await supabase
    .from('collection_points')
    .update({ status: 'available', claim_id: null, pickup_time: null })
    .eq('id', pointId);
  if (pointError) throw pointError;
}

export async function claimCollectionPoint(pointId: string, recyclerId: string, pickupTime: string) {
  // 1. Crear el claim con status 'pending'
  const { data: claim, error: claimError } = await supabase
    .from('collection_claims')
    .insert([
      {
        collection_point_id: pointId,
        recycler_id: recyclerId,
        status: 'pending',
        pickup_time: pickupTime
      }
    ])
    .select()
    .single();

  if (claimError) throw claimError;

  // 2. Actualizar el punto de recolección
  const { error: updateError } = await supabase
    .from('collection_points')
    .update({
      status: 'claimed',
      claim_id: claim.id,
      pickup_time: pickupTime
    })
    .eq('id', pointId);

  if (updateError) throw updateError;
}

export async function completeCollection(claimId: string, pointId: string) {
  // 1. Marcar el claim como completado
  const { error: claimError } = await supabase
    .from('collection_claims')
    .update({ status: 'completed', completed_at: new Date().toISOString() })
    .eq('id', claimId);
  if (claimError) throw claimError;

  // 2. Marcar el punto como completado
  const { error: pointError } = await supabase
    .from('collection_points')
    .update({ status: 'completed' })
    .eq('id', pointId);
  if (pointError) throw pointError;
}

export async function deleteCollectionPoint(pointId: string, userId: string) {
  // Elimina el punto de recolección solo si pertenece al usuario
  const { error } = await supabase
    .from('collection_points')
    .delete()
    .eq('id', pointId)
    .eq('user_id', userId);
  if (error) throw error;
}
