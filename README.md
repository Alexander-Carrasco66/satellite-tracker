# Satellite Tracker

Full-stack web app that tracks 250+ satellites in near real time.

- **Backend:** Flask REST API. Pulls CelesTrak GP (OMM JSON) data, propagates orbits with Skyfield (SGP4), and caches aggressively.
- **Frontend:** React + TypeScript (Vite) with a Leaflet map, search, ground tracks and a watchlist.
- **Database:** PostgreSQL stores users (hashed passwords) and each user's watchlist. Auth uses JWTs.

## Run it

```bash
# 1. Database
docker compose up -d

# 2. Backend (http://localhost:5000)
cd backend
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env        # set JWT_SECRET_KEY
python app.py

# 3. Frontend (http://localhost:5173)
cd ../frontend
npm install
npm run dev
```

## API

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/api/auth/register` | no | `{email, password}` returns a JWT |
| POST | `/api/auth/login` | no | `{email, password}` returns a JWT |
| GET | `/api/auth/me` | yes | Current user |
| GET | `/api/satellites` | no | Live positions: lat, lon, altitude, speed |
| GET | `/api/satellites/<norad_id>/track?minutes=95` | no | Predicted ground track |
| GET/POST | `/api/watchlist` | yes | List or add (`{norad_id}`) |
| DELETE | `/api/watchlist/<norad_id>` | yes | Remove |

## How caching works

1. **GP data:** CelesTrak refreshes element sets roughly every 2 hours and asks clients not to poll more often. The service holds the parsed catalog for 2 hours. If a refresh fails, it keeps serving the stale catalog and retries after 5 minutes.
2. **Positions:** The propagated snapshot is reused for 5 seconds, so any number of browsers polling costs at most one Skyfield pass per 5 seconds.

## Production notes

- Run with `gunicorn -w 1 --threads 4 app:app`. The cache is in-process, so use one worker or move it to Redis for multiple workers.
- Set a strong `JWT_SECRET_KEY` and restrict `CORS_ORIGIN`.
- Add Flask-Migrate for schema changes beyond the initial `create_all`.
