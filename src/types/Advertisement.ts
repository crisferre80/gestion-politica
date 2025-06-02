export interface Advertisement {
  id: string;
  title: string;
  image_url: string;
  link?: string | null;
  active: boolean;
  created_at?: string;
}
