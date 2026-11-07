"""Fetches CelesTrak GP data (cached) and propagates positions with Skyfield."""
import logging
import threading
import time

import numpy as np
import requests
from skyfield.api import EarthSatellite, load, wgs84

log = logging.getLogger(__name__)

CELESTRAK_URL = "https://celestrak.org/NORAD/elements/gp.php"


class SatelliteService:
    def __init__(self, groups, gp_ttl=2 * 3600, retry_after=300, pos_ttl=5):
        self.groups = groups
        self.gp_ttl = gp_ttl          # CelesTrak updates GP data ~every 2 hours
        self.retry_after = retry_after  # back-off after a failed refresh
        self.pos_ttl = pos_ttl        # position snapshot shared across all clients
        self.ts = load.timescale()
        self._lock = threading.Lock()
        self._catalog = {}
        self._catalog_expires = 0.0
        self._positions = []
        self._positions_at = 0.0

    # ---- GP data cache -------------------------------------------------
    def _fetch_group(self, group):
        resp = requests.get(
            CELESTRAK_URL, params={"GROUP": group, "FORMAT": "json"}, timeout=20
        )
        resp.raise_for_status()
        return resp.json()

    def _refresh_catalog(self):
        catalog = {}
        for group in self.groups:
            try:
                records = self._fetch_group(group)
            except Exception as exc:  # network error, rate limit, bad JSON
                log.warning("CelesTrak fetch failed for %s: %s", group, exc)
                continue
            for rec in records:
                try:
                    norad = int(rec["NORAD_CAT_ID"])
                    if norad in catalog:
                        continue
                    catalog[norad] = {
                        "name": rec["OBJECT_NAME"].strip(),
                        "group": group,
                        "sat": EarthSatellite.from_omm(self.ts, rec),
                    }
                except Exception as exc:
                    log.debug("Skipping malformed record: %s", exc)
        if catalog:
            self._catalog = catalog
            self._catalog_expires = time.time() + self.gp_ttl
            self._positions_at = 0.0
            log.info("Loaded %d satellites", len(catalog))
        else:
            # Keep serving stale data and avoid hammering CelesTrak
            self._catalog_expires = time.time() + self.retry_after

    def catalog(self):
        with self._lock:
            if time.time() >= self._catalog_expires:
                self._refresh_catalog()
            return self._catalog

    # ---- Propagation ---------------------------------------------------
    def positions(self):
        catalog = self.catalog()
        with self._lock:
            if self._positions and time.time() - self._positions_at < self.pos_ttl:
                return self._positions
        t = self.ts.now()
        out = []
        for norad, entry in catalog.items():
            try:
                geo = entry["sat"].at(t)
                sub = wgs84.subpoint_of(geo)
                out.append(
                    {
                        "norad_id": norad,
                        "name": entry["name"],
                        "group": entry["group"],
                        "lat": round(float(sub.latitude.degrees), 4),
                        "lon": round(float(sub.longitude.degrees), 4),
                        "alt_km": round(float(sub.elevation.km), 1),
                        "speed_kms": round(float(np.linalg.norm(geo.velocity.km_per_s)), 2),
                    }
                )
            except Exception:
                continue  # SGP4 raises for decayed / invalid orbits
        with self._lock:
            self._positions = out
            self._positions_at = time.time()
        return out

    def track(self, norad, minutes=95, step_s=60):
        entry = self.catalog().get(norad)
        if entry is None:
            return None
        t0 = self.ts.now()
        offsets = np.arange(0, minutes * 60 + 1, step_s) / 86400.0
        times = self.ts.tt_jd(t0.tt + offsets)
        sub = wgs84.subpoint_of(entry["sat"].at(times))
        return [
            [round(float(la), 3), round(float(lo), 3)]
            for la, lo in zip(sub.latitude.degrees, sub.longitude.degrees)
        ]
