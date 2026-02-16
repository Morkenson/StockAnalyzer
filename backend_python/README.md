# StockAnalyzer API (Python)

FastAPI backend for stock data (Twelve Data) and brokerage integration (SnapTrade). The Angular frontend calls `http://localhost:5000/api`.

## Setup

1. **Create a virtual environment** (recommended):

   ```bash
   cd backend_python
   python -m venv .venv
   .venv\Scripts\activate   # Windows
   # source .venv/bin/activate   # macOS/Linux
   ```

2. **Install dependencies**:

   ```bash
   pip install -r requirements.txt
   ```

3. **Environment variables**

   Create a `.env` file in the **project root** or in `backend_python`:

   ```env
   # Twelve Data (stock quotes, search, history)
   TWELVE_DATA_API_KEY=your_twelve_data_api_key
   TWELVE_DATA_API_URL=https://api.twelvedata.com

   # SnapTrade (broker linking, portfolio)
   SNAPTRADE_CLIENT_ID=your_snaptrade_client_id
   SNAPTRADE_CONSUMER_KEY=your_snaptrade_consumer_key
   SNAPTRADE_API_URL=https://api.snaptrade.com/api/v1
   ```

## Run

From the `backend_python` directory:

```bash
uvicorn main:app --host 0.0.0.0 --port 5000 --reload
```

- API base: `http://localhost:5000/api`
- Swagger UI: `http://localhost:5000/docs`

## Structure

- `main.py` – FastAPI app, CORS, route mounting
- `config.py` – Env loading (Twelve Data, SnapTrade)
- `models/` – Pydantic models (stock, SnapTrade, API response)
- `routers/` – `stock.py`, `snaptrade.py` (under `/api`)
- `services/` – `stock_data_service.py`, `snaptrade_service.py`, `user_service.py`
