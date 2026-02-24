# ── Build stage ───────────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY tsconfig*.json angular.json ./
COPY src/ ./src/

RUN npm run build

# ── Production stage ──────────────────────────────────────────────────────────
FROM nginx:alpine AS production

COPY nginx/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/dist/frontend/browser /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]

