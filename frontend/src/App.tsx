import { useCallback, useEffect, useState } from "react";
import { api } from "./api";
import MapView from "./components/MapView";
import Sidebar from "./components/Sidebar";
import type { Satellite, Session, WatchItem } from "./types";

const POLL_MS = 5000;

function loadSession(): Session | null {
  try {
    return JSON.parse(localStorage.getItem("session") || "null");
  } catch {
    return null;
  }
}

export default function App() {
  const [satellites, setSatellites] = useState<Satellite[]>([]);
  const [session, setSession] = useState<Session | null>(loadSession);
  const [watchlist, setWatchlist] = useState<WatchItem[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [track, setTrack] = useState<[number, number][]>([]);
  const [error, setError] = useState("");

  // Poll live positions
  useEffect(() => {
    let alive = true;
    const load = () =>
      api.satellites().then(
        (data) => { if (alive) { setSatellites(data); setError(""); } },
        () => { if (alive) setError("Can't reach the tracking server. Retrying..."); }
      );
    load();
    const id = setInterval(load, POLL_MS);
    return () => { alive = false; clearInterval(id); };
  }, []);

  // Persist session and load watchlist
  useEffect(() => {
    if (!session) {
      localStorage.removeItem("session");
      setWatchlist([]);
      return;
    }
    localStorage.setItem("session", JSON.stringify(session));
    api.watchlist(session.token).then(setWatchlist, () => {
      setSession(null); // token expired or invalid
    });
  }, [session]);

  // Ground track for the selected satellite
  useEffect(() => {
    if (selectedId === null) { setTrack([]); return; }
    let alive = true;
    api.track(selectedId).then((pts) => alive && setTrack(pts), () => alive && setTrack([]));
    return () => { alive = false; };
  }, [selectedId]);

  const watched = new Set(watchlist.map((w) => w.norad_id));

  const toggleWatch = useCallback(
    async (id: number) => {
      if (!session) return;
      try {
        if (watched.has(id)) {
          await api.unwatch(session.token, id);
          setWatchlist((w) => w.filter((i) => i.norad_id !== id));
        } else {
          const item = await api.watch(session.token, id);
          setWatchlist((w) => [...w, item]);
        }
      } catch (err) {
        setError((err as Error).message);
      }
    },
    [session, watchlist] // eslint-disable-line react-hooks/exhaustive-deps
  );

  return (
    <div className="layout">
      <Sidebar
        satellites={satellites}
        watched={watched}
        selectedId={selectedId}
        session={session}
        onSelect={setSelectedId}
        onToggleWatch={toggleWatch}
        onSession={setSession}
        error={error}
      />
      <MapView satellites={satellites} watched={watched} selectedId={selectedId} track={track} onSelect={setSelectedId} />
    </div>
  );
}
