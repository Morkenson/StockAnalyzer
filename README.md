# Mork Wealth

Angular frontend, FastAPI backend, and SQLAlchemy-backed persistence. The database is configured with `DATABASE_URL`, so it can be local Postgres, Supabase Postgres, or any normal PostgreSQL provider.

## Structure

```text
Mork Wealth/
|-- backend/             # FastAPI API for auth, user data, stocks, SnapTrade
|   |-- main.py
|   |-- config.py
|   |-- models/
|   |-- routers/
|   |-- services/
|   |-- tests/
|   `-- requirements.txt
|-- frontend/            # Angular app
|   |-- app/
|   |-- package.json
|   `-- angular.json
|-- .github/workflows/
|-- vercel.json
`-- README.md
```

## Local Dev

Backend:

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 5000 --reload
```

Frontend:

```bash
cd frontend
npm install
npm start
```

Open http://localhost:4200. The frontend calls http://localhost:5000/api.

## Auth

Auth is owned by the FastAPI backend. Signup/signin create a signed JWT in an HttpOnly cookie, and protected app-data routes derive the user from that cookie. Password reset tokens are stored hashed in the database. Set `JWT_SECRET` to a long random value before deploying.

## Deploy

- Frontend: Vercel. `vercel.json` builds from `frontend/`.
- Backend: deploy `backend/` to a Python host such as Railway, Render, or Fly.io.
- Set the frontend `API_BASE_URL` to your deployed backend API URL.

## Docker

```bash
docker compose up --build
```

Frontend: http://localhost:4200
Backend: http://localhost:5000
API docs: http://localhost:5000/docs

## Database Keepalive

The backend owns keepalive. On startup it runs a background task that executes `SELECT 1` through SQLAlchemy using `DATABASE_URL`, then repeats once per day.

You can also manually check it at `GET /api/keepalive`.
