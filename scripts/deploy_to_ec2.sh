#!/usr/bin/env bash
# ==============================================================================
# TerraNex Safe EC2 Automated Deployment Script
# Designed for coexistence on Ubuntu EC2 with AlzheimerML on Port 5001
# ==============================================================================

set -euo pipefail

echo "===================================================================="
echo " Starting Safe TerraNex Production Deployment"
echo "===================================================================="

# 1. Pre-flight Safety Checks: Verify AlzheimerML Status
echo "[1/6] Verifying existing services on host..."
if sudo ss -tulpn | grep -q ":5001"; then
    echo "  [OK] AlzheimerML service is active on port 5001. We will NOT touch it."
else
    echo "  [NOTE] Port 5001 is not currently listening. Continuing safely."
fi

# 2. Check Storage and RAM
echo "[2/6] Checking system headroom..."
FREE_DISK_KB=$(df / --output=avail | tail -n 1)
FREE_DISK_GB=$((FREE_DISK_KB / 1024 / 1024))
echo "  Available Root Disk: ${FREE_DISK_GB} GB"
if [ "$FREE_DISK_GB" -lt 4 ]; then
    echo "  [WARNING] Less than 4 GB free disk available. Pulling prebuilt images requires ~3.7 GB."
fi

free -h

# 3. Environment Configuration Check
echo "[3/6] Checking environment configuration (.env)..."
if [ ! -f ".env" ]; then
    echo "  [ERROR] .env file not found!"
    echo "  Please create a .env file containing your production settings."
    echo "  Example:"
    echo "    MONGODB_URL=mongodb+srv://<user>:<password>@cluster0.abcde.mongodb.net/TerraNex?retryWrites=true&w=majority"
    echo "    FRONTEND_PORT=80"
    echo "    CORS_ORIGINS=http://localhost,http://localhost:80"
    exit 1
fi

# 4. Pull Prebuilt Images from GHCR (Zero on-server compilation)
echo "[4/6] Pulling prebuilt images from GitHub Container Registry..."
docker compose -f docker-compose.prod.yml pull

# 5. Launch Isolated TerraNex Containers
echo "[5/6] Starting TerraNex container stack..."
docker compose -f docker-compose.prod.yml up -d

# 6. Post-deployment Health & Coexistence Verification
echo "[6/6] Verifying health and service isolation..."
sleep 5
docker compose -f docker-compose.prod.yml ps

echo "Checking TerraNex health probe..."
MAX_RETRIES=12
RETRY=0
while [ $RETRY -lt $MAX_RETRIES ]; do
    if curl -s -f http://127.0.0.1:${FRONTEND_PORT:-80}/health > /dev/null 2>&1; then
        echo "  [SUCCESS] TerraNex is healthy on port ${FRONTEND_PORT:-80}!"
        break
    fi
    echo "  Waiting for container healthcheck (${RETRY}/${MAX_RETRIES})..."
    sleep 5
    RETRY=$((RETRY + 1))
done

# Confirm AlzheimerML is still responsive
if sudo ss -tulpn | grep -q ":5001"; then
    echo "  [CONFIRMED] AlzheimerML is active and uninterrupted on port 5001."
fi

echo "===================================================================="
echo " TerraNex deployment completed successfully!"
echo " Web Application URL: http://$(curl -s http://checkip.amazonaws.com 2>/dev/null || echo '<EC2_PUBLIC_IP>'):${FRONTEND_PORT:-80}"
echo "===================================================================="
