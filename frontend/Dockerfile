# ==============================================================================
# Stage 1: Build the React Application
# ==============================================================================
FROM node:20-alpine AS build

WORKDIR /app

# Install dependencies using clean package-lock install
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci

# Copy application source code
COPY frontend/ ./

# Build arguments for Vite
ARG VITE_API_BASE_URL=""
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL

# Build production bundle
RUN npm run build

# ==============================================================================
# Stage 2: Serve Production Assets with Nginx
# ==============================================================================
FROM nginx:1.27-alpine

# Remove default nginx static assets
RUN rm -rf /usr/share/nginx/html/*

# Copy compiled static assets from build stage
COPY --from=build /app/dist /usr/share/nginx/html

# Copy custom Nginx configuration with SPA fallback and API proxy
COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf

# Expose HTTP port
EXPOSE 80

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
    CMD wget -qO- http://127.0.0.1/ || exit 1

# Start Nginx server in foreground
CMD ["nginx", "-g", "daemon off;"]
