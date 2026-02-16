# StockAnalyzer

A stock analysis app with an **Angular** frontend and **Python (FastAPI)** backend, plus SnapTrade for brokerage linking.

## Project structure

```
StockAnalyzer/
├── backend_python/     # API (FastAPI) – stock data, SnapTrade
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
   cd backend_python
   python -m venv .venv
   .venv\Scripts\activate    # Windows
   pip install -r requirements.txt
   # Add .env with TWELVE_DATA_API_KEY (see backend_python/README.md)
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
- **Backend:** Deploy `backend_python` (e.g. Railway, Render, Fly.io) and point the frontend’s production `api.baseUrl` to that URL.
