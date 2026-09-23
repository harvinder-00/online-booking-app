# Small, fast image - no external npm packages to install
FROM node:18-alpine

WORKDIR /app

# Copy source (package.json first so Docker layer caching still works
# even though there's nothing to `npm install` here)
COPY package.json ./
COPY server.js ./
COPY public ./public

ENV PORT=3000
EXPOSE 3000

# Basic container-level health check - Docker will mark the container
# unhealthy if the app stops responding, which is a simple form of monitoring.
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', r => process.exit(r.statusCode===200?0:1)).on('error', () => process.exit(1))"

CMD ["node", "server.js"]
