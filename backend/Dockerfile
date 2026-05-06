FROM python:3.11-slim

WORKDIR /app

# OS dependencies for numpy/scipy/scikit-learn builds & mecab (optional)
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc g++ libpq-dev curl \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies first (layer cache)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Download GiNZA model — fail gracefully; MeCab/simple fallback is used if unavailable
RUN python -m spacy download ja_ginza 2>/dev/null || echo "[INFO] ja_ginza unavailable — morphological fallback active"

# Copy source
COPY . .

EXPOSE 8000

HEALTHCHECK --interval=15s --timeout=5s --start-period=30s --retries=3 \
    CMD curl -f http://localhost:8000/api/health || exit 1

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "1"]
