FROM python:3.11-slim

WORKDIR /app

# Build tools + libpq for asyncpg
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc g++ libpq-dev curl \
    && rm -rf /var/lib/apt/lists/*

# ── Core dependencies (must succeed) ─────────────────────────────────────────
COPY requirements.txt .
RUN pip install --no-cache-dir --prefer-binary -r requirements.txt

# ── Optional: Kalman filter library ──────────────────────────────────────────
RUN pip install --no-cache-dir --prefer-binary filterpy==1.4.5 \
    || echo "[INFO] filterpy unavailable — Kalman filter will use numpy fallback"

# ── Optional: Japanese NLP (spaCy + GiNZA) ───────────────────────────────────
RUN pip install --no-cache-dir --prefer-binary "spacy==3.7.4" "ja-ginza==5.1.3" \
    || echo "[INFO] spaCy/GiNZA unavailable — morphological fallback active"

RUN python -m spacy download ja_ginza 2>/dev/null \
    || echo "[INFO] ja_ginza model download skipped"

# ── Application source ────────────────────────────────────────────────────────
COPY . .

EXPOSE 8000

HEALTHCHECK --interval=15s --timeout=5s --start-period=30s --retries=3 \
    CMD curl -f http://localhost:8000/api/health || exit 1

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "1"]
