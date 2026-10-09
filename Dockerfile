# syntax=docker/dockerfile:1

# Stage 1: Compilación de TypeScript
FROM node:24-alpine AS builder

WORKDIR /usr/src/app

ENV PUPPETEER_SKIP_DOWNLOAD=true

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build:server

# Stage 2: Imagen ligera de ejecución en producción para Fly.io
FROM node:24-alpine

WORKDIR /usr/src/app

ENV NODE_ENV=production
ENV PUPPETEER_SKIP_DOWNLOAD=true

COPY package*.json ./
RUN npm ci --omit=dev

COPY --chown=node:node --from=builder /usr/src/app/dist ./dist

USER node

EXPOSE 3000

CMD ["node", "--max-old-space-size=180", "dist/src/server.js"]
