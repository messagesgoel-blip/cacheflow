FROM node:22-alpine

# Install tini for proper signal handling
RUN apk add --no-cache tini

WORKDIR /app

# Host rclone binary (network unavailable during build)
COPY rclone /usr/local/bin/rclone
RUN chmod +x /usr/local/bin/rclone

# Copy pre-installed node_modules (chokidar + dotenv + pg stack)
COPY node_modules ./node_modules

COPY sync-worker.js config.js .

# Use tini as init process to handle signals properly
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "sync-worker.js"]
