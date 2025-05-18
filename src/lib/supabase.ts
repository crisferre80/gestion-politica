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
  email: string;
  name: string;
  type: 'recycler' | 'resident' | 'admin';
  avatar_url?: string;
  phone?: string;
  address?: string;
  materials?: string[];
  schedule?: string;
  bio?: string;
}

export type CollectionPoint = {
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
    // Check if user already exists
    const { data: existingProfile } = await supabase
      .from('profiles')
      .select('id')
      .eq('email', email)
      .maybeSingle();

    if (existingProfile) {
      return { data: null, error: new Error('User already registered') };
    }

    // Create auth user
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

    // Create profile
    const { error: profileError } = await supabase
      .from('profiles')
      .insert([{
        user_id: authData.user.id,
        email: email,
        name: userData.name,
        role: userData.type,
      }]);

    if (profileError) {
      // If profile creation fails, delete the auth user
      await supabase.auth.admin.deleteUser(authData.user.id);
      throw profileError;
    }

    return { data: authData, error: null };
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

    // Get profile
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', authData.user.id)
      .maybeSingle();

    if (profileError) throw profileError;
    if (!profile) {
      // Create profile if it doesn't exist
      const { error: createProfileError } = await supabase
        .from('profiles')
        .insert([{
          user_id: authData.user.id,
          email: authData.user.email!,
          name: authData.user.user_metadata.name || '',
          role: authData.user.user_metadata.type || 'resident',
        }]);

      if (createProfileError) throw new Error('Failed to create profile');

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
    }

    // Map role to type for consistency with the User interface
    return { 
      data: authData, 
      profile: { ...profile, type: profile.role }
    };
  } catch (error: unknown) {
    console.error('SignIn error:', error);
    throw error;
  }
}

export async function cancelClaim(
  claimId: string, 
  pointId: string, 
  userId: string,
  reason: string
): Promise<void> {
  try {
    const { error: claimError } = await supabase
      .from('collection_claims')
      .update({
        status: 'cancelled',
        cancelled_at: new Date().toISOString(),
        cancelled_by: userId,
        cancellation_reason: reason
      })
      .eq('id', claimId);

    if (claimError) throw claimError;

    const { error: pointError } = await supabase
      .from('collection_points')
      .update({ 
        status: 'available',
        claim_id: null,
        pickup_time: null
      })
      .eq('id', pointId);

    if (pointError) throw pointError;
  } catch (error) {
    console.error('Error cancelling claim:', error);
    throw error;
  }
}

export async function deleteCollectionPoint(pointId: string): Promise<void> {
  try {
    const { error } = await supabase
      .from('collection_points')
      .delete()
      .eq('id', pointId);

    if (error) throw error;
  } catch (error) {
    console.error('Error deleting collection point:', error);
    throw error;
  }
}

export async function fetchRecyclerProfiles(): Promise<RecyclerProfile[]> {
  try {
    const { data, error } = await supabase
      .from('recycler_profiles')
      .select(`
        *,
        profiles!recycler_profiles_user_id_fkey (
          name,
          email,
          phone,
          avatar_url
        )
      `)
      .order('rating_average', { ascending: false });

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error fetching recycler profiles:', error);
    throw error;
  }
}

export async function uploadProfilePhoto(userId: string, file: File) {
  try {
    const fileExt = file.name.split('.').pop();
    const fileName = `${userId}-${Math.random()}.${fileExt}`;
    const filePath = `${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(filePath, file);

    if (uploadError) throw uploadError;

    const { data: { publicUrl } } = supabase.storage
      .from('avatars')
      .getPublicUrl(filePath);

    const { error: updateError } = await supabase
      .from('profiles')
      .update({ avatar_url: publicUrl })
      .eq('user_id', userId);

    if (updateError) throw updateError;

    return publicUrl;
  } catch (error) {
    console.error('Error uploading profile photo:', error);
    throw error;
  }
}

export async function fetchRecyclers() {
  const { data, error } = await supabase
    .from('recycler_profiles')
    .select(`
      *,
      profiles!recycler_profiles_user_id_fkey(
        name,
        email,
        phone
      )
    `)
    .order('rating_average', { ascending: false });

  if (error) throw error;
  return data;
}

export async function claimCollectionPoint(pointId: string, recyclerId: string, pickupTime: string) {
  const { data: claim, error: claimError } = await supabase
    .from('collection_claims')
    .insert([{
      collection_point_id: pointId,
      recycler_id: recyclerId,
      status: 'pending',
      pickup_time: pickupTime
    }])
    .select()
    .single();

  if (claimError) throw claimError;

  // Update collection point status
  const { error: updateError } = await supabase
    .from('collection_points')
    .update({ 
      status: 'claimed',
      claim_id: recyclerId,
      pickup_time: pickupTime
    })
    .eq('id', pointId);

  if (updateError) throw updateError;

  return claim;
}

export async function fetchCollectionPoints() {
  const { data, error } = await supabase
    .from('collection_points')
    .select(`
      *,
      profiles!collection_points_user_id_fkey(
        name,
        email,
        phone
      ),
      claims:collection_claims(*)
    `)
    .order('created_at', { ascending: false });

  if (error) throw error;

  return data.map(point => ({
    ...point,
    creator_name: point.profiles.name,
    creator_email: point.profiles.email,
    creator_phone: point.profiles.phone,
    status: point.claims?.[0]?.status === 'pending' ? 'claimed' : 'available',
    claim_id: point.claims?.[0]?.id,
    pickup_time: point.claims?.[0]?.pickup_time
  })) as CollectionPoint[];
}

export async function createCollectionPoint(point: Omit<CollectionPoint, 'id' | 'created_at' | 'updated_at' | 'creator_name'>) {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) throw new Error('User not authenticated');

    const { data, error } = await supabase
      .from('collection_points')
      .insert([{
        ...point,
        status: 'available'
      }])
      .select(`
        *,
        profiles!collection_points_user_id_fkey(
          name,
          email,
          phone
        )
      `)
      .single();

    if (error) throw error;
    
    return {
      ...data,
      creator_name: data.profiles.name,
      creator_email: data.profiles.email,
      creator_phone: data.profiles.phone
    } as CollectionPoint;
  } catch (error) {
    console.error('Error creating collection point:', error);
    throw error;
  }
}