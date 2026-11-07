import { useMemo, useState } from "react";
import type { Satellite, Session } from "../types";
import AuthForm from "./AuthForm";

interface Props {
  satellites: Satellite[];
  watched: Set<number>;
  selectedId: number | null;
  session: Session | null;
  onSelect: (id: number) => void;
  onToggleWatch: (id: number) => void;
  onSession: (s: Session | null) => void;
  error: string;
}

export default function Sidebar(p: Props) {
  const [query, setQuery] = useState("");
  const [watchOnly, setWatchOnly] = useState(false);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return p.satellites
      .filter((s) => (!watchOnly || p.watched.has(s.norad_id)) && (!q || s.name.toLowerCase().includes(q) || String(s.norad_id).includes(q)))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [p.satellites, p.watched, query, watchOnly]);

  const selected = p.satellites.find((s) => s.norad_id === p.selectedId);

  return (
    <aside className="sidebar">
      <header>
        <h1>Satellite Tracker</h1>
        <p className="hint">{p.satellites.length} satellites, updated every 5 seconds</p>
      </header>

      {p.session ? (
        <div className="account">
          <span>{p.session.email}</span>
          <button className="link" onClick={() => p.onSession(null)}>Sign out</button>
        </div>
      ) : (
        <AuthForm onSession={p.onSession} />
      )}

      {p.error && <p className="error" role="alert">{p.error}</p>}

      {selected && (
        <section className="detail">
          <h2>{selected.name}</h2>
          <dl>
            <dt>NORAD ID</dt><dd>{selected.norad_id}</dd>
            <dt>Altitude</dt><dd>{selected.alt_km.toLocaleString()} km</dd>
            <dt>Speed</dt><dd>{selected.speed_kms} km/s</dd>
            <dt>Position</dt><dd>{selected.lat.toFixed(2)}°, {selected.lon.toFixed(2)}°</dd>
          </dl>
        </section>
      )}

      <div className="filters">
        <input type="search" placeholder="Search by name or NORAD ID" value={query} onChange={(e) => setQuery(e.target.value)} />
        {p.session && (
          <label>
            <input type="checkbox" checked={watchOnly} onChange={(e) => setWatchOnly(e.target.checked)} />
            Watchlist only ({p.watched.size})
          </label>
        )}
      </div>

      <ul className="list">
        {rows.map((s) => (
          <li key={s.norad_id} className={s.norad_id === p.selectedId ? "active" : ""}>
            <button className="name" onClick={() => p.onSelect(s.norad_id)}>{s.name}</button>
            {p.session && (
              <button
                className={`star ${p.watched.has(s.norad_id) ? "on" : ""}`}
                aria-pressed={p.watched.has(s.norad_id)}
                aria-label={p.watched.has(s.norad_id) ? `Remove ${s.name} from watchlist` : `Add ${s.name} to watchlist`}
                onClick={() => p.onToggleWatch(s.norad_id)}
              >
                {p.watched.has(s.norad_id) ? "★" : "☆"}
              </button>
            )}
          </li>
        ))}
        {rows.length === 0 && <li className="empty">No satellites match.</li>}
      </ul>
    </aside>
  );
}
