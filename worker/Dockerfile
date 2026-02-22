FROM node:22-alpine

WORKDIR /app

# Host rclone binary (network unavailable during build)
COPY rclone /usr/local/bin/rclone
RUN chmod +x /usr/local/bin/rclone

# Copy pre-installed node_modules (chokidar + dotenv + pg stack)
COPY node_modules ./node_modules

COPY sync-worker.js .

CMD ["node", "sync-worker.js"]
