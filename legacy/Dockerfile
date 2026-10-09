FROM node:24-alpine

WORKDIR /usr/src/app

ENV NODE_ENV=production
ENV PUPPETEER_SKIP_DOWNLOAD=true

COPY package*.json ./
RUN npm ci --omit=dev

COPY --chown=node:node . .

USER node

EXPOSE 3000

CMD ["node", "--max-old-space-size=180", "legacy/index.js"]
