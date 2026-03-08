FROM node:22-alpine

# Install tini and rclone (ARM64)
RUN apk add --no-cache tini curl unzip && \
    curl -sO https://downloads.rclone.org/rclone-current-linux-arm64.zip && \
    unzip -o rclone-current-linux-arm64.zip && \
    cp rclone-*-linux-arm64/rclone /usr/local/bin/ && \
    chmod +x /usr/local/bin/rclone && \
    rm -rf rclone-*-linux-arm64 rclone-current-linux-arm64.zip

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

