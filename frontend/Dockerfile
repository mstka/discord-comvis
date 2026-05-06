# ── Stage 1: Build React app ──────────────────────────────────────────────────
FROM node:20-slim AS builder

WORKDIR /app

# Install JS dependencies first (layer cache)
COPY package*.json ./
RUN npm install --legacy-peer-deps

# Copy source
COPY . .

# Install IPA Ex Gothic — a static Japanese TTF from Debian package repos.
# This runs AFTER COPY so that src files cannot overwrite the installed fonts.
# ipaexg.ttf is a genuine static TrueType font (not variable) and is fully
# supported by @react-pdf/renderer's fontkit.
RUN apt-get update && apt-get install -y --no-install-recommends fonts-ipaexfont-gothic \
    && mkdir -p public/fonts \
    && cp /usr/share/fonts/opentype/ipaexfont-gothic/ipaexg.ttf public/fonts/NotoSansJP-Regular.ttf \
    && cp /usr/share/fonts/opentype/ipaexfont-gothic/ipaexg.ttf public/fonts/NotoSansJP-Bold.ttf \
    && ls -lh public/fonts/ \
    && rm -rf /var/lib/apt/lists/*

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
