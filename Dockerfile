FROM node:22-alpine AS base
WORKDIR /app

COPY package.json package-lock.json* ./
COPY vendor ./vendor
RUN npm install

COPY . .
RUN npm run build

EXPOSE 3000
CMD ["node", "dist/server.js"]
