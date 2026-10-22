# ==========================================
# 1. Base Stage: Ortak Sistem Bağımlılıkları
# ==========================================
FROM node:20-bookworm-slim AS base

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN npm install -g pnpm@9.15.0

# FFmpeg, FFprobe ve Türkçe/Latin karakter destekli font paketleri
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    fontconfig \
    fonts-dejavu-core \
    fonts-freefont-ttf \
    fonts-liberation \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# ==========================================
# 2. Dependencies & Build Stage (Backend)
# ==========================================
FROM base AS builder

COPY package.json pnpm-lock.yaml ./
RUN pnpm install

COPY tsconfig.json drizzle.config.ts ./
COPY src/ ./src/

# Backend TypeScript derlemesini çalıştır -> dist/main.js
RUN pnpm run build

# Sadece production bağımlılıklarını bırak (devDependencies temizlenir)
RUN pnpm prune --prod

# ==========================================
# 3. Production Runner Stage
# ==========================================
FROM base AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

# Builder stage'den hazır production paketlerini ve derlenmiş dosyaları kopyala
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist

# Hazır derlenmiş Frontend Admin Panelini kopyala
COPY client/dist ./client/dist

# Drizzle migration dosyalarını ve statik varlıkları kopyala
COPY src/db/migrations ./src/db/migrations
COPY drizzle.config.ts ./
COPY assets ./assets

# Medya çıktı klasörlerini oluştur
RUN mkdir -p output/images output/videos

EXPOSE 3000

CMD ["node", "dist/main.js"]
