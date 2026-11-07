import { useEffect } from "react";
import { CircleMarker, MapContainer, Polyline, TileLayer, Tooltip, useMap } from "react-leaflet";
import type { Satellite } from "../types";

interface Props {
  satellites: Satellite[];
  watched: Set<number>;
  selectedId: number | null;
  track: [number, number][];
  onSelect: (id: number) => void;
}

// Unwraps longitudes so the line continues off the edge of the map seamlessly
function unwrapTrack(points: [number, number][]): [number, number][] {
  let lonOffset = 0;
  
  return points.map((p, i) => {
    const [lat, lon] = p;
    
    if (i > 0) {
      const prevLon = points[i - 1][1];
      const diff = lon - prevLon;
      
      // If the difference is huge, the satellite crossed the antimeridian
      if (diff < -180) {
        lonOffset += 360;
      } else if (diff > 180) {
        lonOffset -= 360;
      }
    }
    
    return [lat, lon + lonOffset];
  });
}

function PanToSelected({ sat }: { sat?: Satellite }) {
  const map = useMap();
  const id = sat?.norad_id;
  useEffect(() => {
    if (sat) map.panTo([sat.lat, sat.lon], { animate: true });
    // Only re-center when the selection changes, not on every position update.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);
  return null;
}

export default function MapView({ satellites, watched, selectedId, track, onSelect }: Props) {
  const selected = satellites.find((s) => s.norad_id === selectedId);
  return (
    <MapContainer center={[20, 0]} zoom={2} minZoom={2} worldCopyJump className="map">
      <TileLayer
  url={`https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png?key=${import.meta.env.VITE_CARTO_API_KEY}`}
  attribution='&copy; OpenStreetMap contributors &copy; CARTO'
/>
<TileLayer
        url={`https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png?key=${import.meta.env.VITE_CARTO_API_KEY}`}
        attribution='&copy; OpenStreetMap contributors &copy; CARTO'
      />
      
      <Polyline 
        positions={unwrapTrack(track)} 
        pathOptions={{ color: "#5ad1e6", weight: 2, dashArray: "6 6" }} 
      />
      {satellites.map((s) => {
        const isSel = s.norad_id === selectedId;
        const isWatched = watched.has(s.norad_id);
        return (
          <CircleMarker
            key={s.norad_id}
            center={[s.lat, s.lon]}
            radius={isSel ? 8 : isWatched ? 6 : 3.5}
            pathOptions={{
              color: isSel ? "#5ad1e6" : isWatched ? "#ffb347" : "#8b9bb4",
              fillColor: isSel ? "#5ad1e6" : isWatched ? "#ffb347" : "#8b9bb4",
              fillOpacity: 0.85,
              weight: isSel ? 2 : 1,
            }}
            eventHandlers={{ click: () => onSelect(s.norad_id) }}
          >
            <Tooltip>{s.name}</Tooltip>
          </CircleMarker>
        );
      })}
      <PanToSelected sat={selected} />
    </MapContainer>
  );
}
