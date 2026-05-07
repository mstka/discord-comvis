# ── Stage 1: Build React app ──────────────────────────────────────────────────
FROM node:20-slim AS builder

WORKDIR /app

# Install JS dependencies first (layer cache)
COPY package*.json ./
RUN npm install --legacy-peer-deps

# Copy source
COPY . .

# Install IPA Ex Gothic (static Japanese TTF) from Debian package repos.
# - Runs AFTER `COPY . .` so source files cannot overwrite the font.
# - Uses `find` to locate the .ttf regardless of exact package path.
# - `file` command confirms the format is TrueType before the build.
RUN apt-get update && apt-get install -y --no-install-recommends \
        fonts-ipaexfont-gothic file \
    && FONT=$(find /usr/share/fonts -name "ipaexg.ttf" | head -1) \
    && echo "[font] found at: $FONT" \
    && file "$FONT" \
    && mkdir -p public/fonts \
    && cp "$FONT" public/fonts/NotoSansJP-Regular.ttf \
    && cp "$FONT" public/fonts/NotoSansJP-Bold.ttf \
    && ls -lh public/fonts/ \
    && rm -rf /var/lib/apt/lists/*

RUN npm run build

# ── Stage 2: Serve with Nginx ─────────────────────────────────────────────────
FROM nginx:1.25-alpine

# Copy built assets (includes dist/fonts/)
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy custom nginx config
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

HEALTHCHECK --interval=15s --timeout=5s --start-period=10s --retries=3 \
    CMD wget -qO- http://localhost/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
