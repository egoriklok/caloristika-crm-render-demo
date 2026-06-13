FROM node:24-bookworm-slim AS deps

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM deps AS builder

WORKDIR /app
COPY . .
RUN npm run build

FROM node:24-bookworm-slim AS runner

ENV NODE_ENV=production \
    PORT=3011 \
    HOSTNAME=0.0.0.0 \
    LUNCH_UP_CRM_DB_PATH=/app/data/lunch_up_crm.sqlite \
    LUNCH_UP_SQLITE_BUSY_TIMEOUT_MS=5000 \
    LUNCH_UP_SQLITE_MMAP_SIZE=268435456 \
    LUNCH_UP_SQLITE_WAL=1

WORKDIR /app
RUN mkdir -p /app/data && chown -R node:node /app

COPY --from=builder --chown=node:node /app/public ./public
COPY --from=builder --chown=node:node /app/.next/standalone ./
COPY --from=builder --chown=node:node /app/.next/static ./.next/static

USER node
EXPOSE 3011

CMD ["node", "server.js"]
