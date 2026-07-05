# Debian-based, not Alpine: onnxruntime-node's prebuilt native binding is
# linked against glibc, which Alpine (musl libc) doesn't have -- it fails to
# load there with ERR_DLOPEN_FAILED at runtime, no matter how it's installed.
FROM node:22-slim AS base
WORKDIR /app

COPY package.json package-lock.json* ./
COPY vendor ./vendor
COPY scripts ./scripts
RUN npm install

COPY . .
RUN npm run build

EXPOSE 3000
CMD ["node", "dist/server.js"]
