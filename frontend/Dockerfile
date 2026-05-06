# ── Stage 1: Build React app ──────────────────────────────────────────────────
FROM node:20-slim AS builder

WORKDIR /app

# Install curl for font download
RUN apt-get update && apt-get install -y --no-install-recommends curl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Install JS dependencies first (layer cache)
COPY package*.json ./
RUN npm install --legacy-peer-deps

# Download Noto Sans JP OTF (static, non-variable) into public/fonts/.
# notofonts/japanese ships static OTF in fonts/otf/ — variable TTF in fonts/variable/
# is NOT supported by @react-pdf/renderer's fontkit.
RUN mkdir -p public/fonts && \
    curl -fsSL --retry 3 \
      "https://cdn.jsdelivr.net/gh/notofonts/japanese@main/fonts/otf/NotoSansJP-Regular.otf" \
      -o public/fonts/NotoSansJP-Regular.otf && \
    curl -fsSL --retry 3 \
      "https://cdn.jsdelivr.net/gh/notofonts/japanese@main/fonts/otf/NotoSansJP-Bold.otf" \
      -o public/fonts/NotoSansJP-Bold.otf && \
    ls -lh public/fonts/ && \
    echo "[fonts] Noto Sans JP OTF downloaded OK"

# Copy source and build
COPY . .
RUN npm run build

# ── Stage 2: Serve with Nginx ─────────────────────────────────────────────────
FROM nginx:1.25-alpine

# Copy built assets (includes public/fonts/ → dist/fonts/)
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy custom nginx config
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

HEALTHCHECK --interval=15s --timeout=5s --start-period=10s --retries=3 \
    CMD wget -qO- http://localhost/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
