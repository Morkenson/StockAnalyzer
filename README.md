# StockAnalyzer

A stock analysis app with an **Angular** frontend and **Python (FastAPI)** backend, plus SnapTrade for brokerage linking.

## Project structure

```
StockAnalyzer/
├── backend/             # API (FastAPI) – stock data, SnapTrade
│   ├── main.py         # App entry, CORS, routes
│   ├── config.py       # Env (Twelve Data, SnapTrade)
│   ├── models/         # Pydantic models
│   ├── routers/        # /api/stock, /api/snaptrade
│   ├── services/       # HTTP clients, user store
│   ├── requirements.txt
│   └── README.md
├── frontend/           # Angular app
│   ├── src/app/
│   │   ├── components/  # Dashboard, watchlist, portfolio, etc.
│   │   ├── services/    # API and Supabase
│   │   ├── models/
│   │   └── ...
│   └── ...
├── .gitignore
├── vercel.json         # Frontend deploy (Vercel)
└── README.md
```

## Run locally

1. **Backend** (from repo root):

   ```bash
   cd backend
   python -m venv .venv
   .venv\Scripts\activate    # Windows
   pip install -r requirements.txt
   # Add .env with TWELVE_DATA_API_KEY (see backend/README.md)
   uvicorn main:app --host 0.0.0.0 --port 5000 --reload
   ```

2. **Frontend** (in another terminal):

   ```bash
   cd frontend
   npm install
   npm start
   ```

3. Open **http://localhost:4200**. The app uses the API at **http://localhost:5000/api**.

## Deploy

- **Frontend:** Vercel (see `vercel.json`). Set `API_BASE_URL` for production if your API is elsewhere.
- **Backend:** Deploy `backend` (e.g. Railway, Render, Fly.io) and point the frontend’s production `api.baseUrl` to that URL.

### Supabase keepalive (free tier)

To prevent Supabase from pausing the project after inactivity:

1. **Backend:** Set `SUPABASE_URL` and `SUPABASE_ANON_KEY` in your backend’s environment. The `/api/keepalive` route will ping Supabase when called.

2. **Daily ping** (choose one):

   - **GitHub Actions** (included): In the repo go to **Settings → Secrets and variables → Actions**, add a secret `KEEPALIVE_URL` with your full keepalive URL (e.g. `https://your-backend.railway.app/api/keepalive`). The workflow [.github/workflows/supabase-keepalive.yml](.github/workflows/supabase-keepalive.yml) runs daily at 12:00 UTC. You can also run it manually from the **Actions** tab.

   - **cron-job.org / UptimeRobot:** Create a free job or monitor that requests `https://<your-backend-url>/api/keepalive` once per day. No auth or custom headers.
