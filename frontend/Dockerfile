# ── Stage 1: Build React app ──────────────────────────────────────────────────
FROM node:20-slim AS builder

WORKDIR /app

# Install curl for font download
RUN apt-get update && apt-get install -y --no-install-recommends curl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Install JS dependencies first (layer cache)
COPY package*.json ./
RUN npm install --legacy-peer-deps

# Download Noto Sans JP TTF into public/fonts/ so Vite includes it in the build.
# @react-pdf/renderer fetches fonts from the browser, so they must be served by nginx.
RUN mkdir -p public/fonts && \
    curl -fL --retry 3 \
      "https://cdn.jsdelivr.net/gh/notofonts/japanese@main/fonts/ttf/NotoSansJP-Regular.ttf" \
      -o public/fonts/NotoSansJP-Regular.ttf && \
    curl -fL --retry 3 \
      "https://cdn.jsdelivr.net/gh/notofonts/japanese@main/fonts/ttf/NotoSansJP-Bold.ttf" \
      -o public/fonts/NotoSansJP-Bold.ttf && \
    echo "[fonts] Noto Sans JP downloaded OK" || \
    echo "[fonts] WARNING: font download failed — PDF will not render Japanese"

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
