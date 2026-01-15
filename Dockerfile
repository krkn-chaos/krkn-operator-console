# Stage 1: Build React app
FROM docker.io/library/node:18-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production=false

# Copy source code
COPY . .

# Build application
RUN npm run build

# Stage 2: Serve with Caddy
FROM docker.io/library/caddy:2-alpine

# Copy built assets from builder
COPY --from=builder /app/dist /usr/share/caddy

# Copy Caddy configuration
COPY Caddyfile /etc/caddy/Caddyfile

# Remove capabilities to bind to privileged ports (OpenShift compatibility)
# This allows Caddy to run without CAP_NET_BIND_SERVICE
RUN setcap -r /usr/bin/caddy

# Ensure directories are writable by any user (OpenShift compatibility)
# Caddy needs to write to /data and /config
RUN chmod -R 777 /data /config /usr/share/caddy && \
    chmod 666 /etc/caddy/Caddyfile

# Expose port 8080
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://localhost:8080/health || exit 1

# Start Caddy
CMD ["caddy", "run", "--config", "/etc/caddy/Caddyfile"]
