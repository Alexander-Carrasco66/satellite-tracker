export interface Satellite {
  norad_id: number;
  name: string;
  group: string;
  lat: number;
  lon: number;
  alt_km: number;
  speed_kms: number;
}

export interface WatchItem {
  norad_id: number;
  name: string;
}

export interface Session {
  token: string;
  email: string;
}
