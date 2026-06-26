export interface Album {
  id: string;
  name: string;
  year: number | null;
  artist: string;
  spotifyId: string | null;
  groups: string[];
  priority: number;
  muted: boolean;
}

export interface Listen {
  albumId: string;
  index: number; // position within that album's encoded Listens list, for targeted rewrites
  date: string; // YYYYMMDD
  rating: string; // '' | 'S' | 'A' | 'B' | 'C' | 'D'
}
