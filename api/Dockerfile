FROM node:22-alpine

# Install tini for proper signal handling
RUN apk add --no-cache tini

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY src/ ./src/

USER node

EXPOSE 8100

HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD wget -qO- http://localhost:8100/health || exit 1

# Use tini as init process to handle signals properly
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "src/index.js"]
