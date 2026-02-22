FROM node:22-alpine

WORKDIR /app

# Use host rclone binary (network unavailable during build)
COPY rclone /usr/local/bin/rclone
RUN chmod +x /usr/local/bin/rclone

# Install only what the worker needs
RUN npm install chokidar dotenv

COPY sync-worker.js .

CMD ["node", "sync-worker.js"]
