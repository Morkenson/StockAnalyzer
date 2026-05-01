FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    WATCHFILES_IGNORE_PERMISSION_DENIED=true

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 5000

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "5000", "--proxy-headers", "--reload", "--reload-dir", "/app", "--reload-exclude", "pytest-cache-files-*", "--reload-exclude", ".pytest_cache", "--reload-exclude", "__pycache__"]
