// Tipos para las zonas de administrador
export interface Zone {
  id: string;
  name: string;
  coordinates: number[][][]; // Array de polígonos en formato [[[lng, lat]]]
  color?: string;
  created_at: string;
  created_by?: string;
  updated_at?: string;
}

// Tipo para crear una nueva zona
export interface CreateZoneInput {
  name: string;
  coordinates: number[][][];
  color?: string;
}

// Tipo para actualizar una zona existente
export interface UpdateZoneInput {
  name?: string;
  coordinates?: number[][][];
  color?: string;
}