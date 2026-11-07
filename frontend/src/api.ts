import type { Satellite, Session, WatchItem } from "./types";

async function request<T>(path: string, options: RequestInit = {}, token?: string): Promise<T> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`/api${path}`, { ...options, headers });
  if (res.status === 204) return undefined as T;
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || body.msg || `Request failed (${res.status})`);
  return body as T;
}

export const api = {
  satellites: () => request<{ satellites: Satellite[] }>("/satellites").then((r) => r.satellites),
  track: (id: number) =>
    request<{ points: [number, number][] }>(`/satellites/${id}/track`).then((r) => r.points),
  auth: (mode: "login" | "register", email: string, password: string) =>
    request<Session>(`/auth/${mode}`, { method: "POST", body: JSON.stringify({ email, password }) }),
  watchlist: (token: string) =>
    request<{ watchlist: WatchItem[] }>("/watchlist", {}, token).then((r) => r.watchlist),
  watch: (token: string, id: number) =>
    request<WatchItem>("/watchlist", { method: "POST", body: JSON.stringify({ norad_id: id }) }, token),
  unwatch: (token: string, id: number) => request<void>(`/watchlist/${id}`, { method: "DELETE" }, token),
};
