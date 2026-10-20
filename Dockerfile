# Matches .nvmrc; this image ships npm 11.13.0, which package.json's engines requires.
FROM node:26.2.0-slim

WORKDIR /app
ENV NODE_ENV=production

COPY package.json package-lock.json .npmrc ./
RUN npm ci --omit=dev

COPY src ./src

USER node
CMD ["node", "src/server.js"]
