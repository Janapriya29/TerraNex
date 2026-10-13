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

# 2. Disk Space Pre-Check & Option 2 Capacity Optimization
echo "[2/6] Checking storage and optimizing host capacity..."
FREE_DISK_KB=$(df / --output=avail | tail -n 1)
FREE_DISK_GB=$((FREE_DISK_KB / 1024 / 1024))
echo "  Available Root Disk: ${FREE_DISK_GB} GB"
if [ "$FREE_DISK_GB" -lt 4 ]; then
    echo "  [ABORT] Insufficient disk space: only ${FREE_DISK_GB} GB available."
    echo "  At least 4 GB free disk is required to safely provision swap and pull images."
    exit 1
fi

if docker ps --format '{{.Names}}' 2>/dev/null | grep -q -i "minikube"; then
    echo "  [ACTION] Pausing/stopping Minikube container to free ~1.1 GB RAM..."
    docker stop minikube || true
    echo "  [OK] Minikube stopped safely. AlzheimerML (port 5001) is untouched."
    echo "  [NOTE] To restart Minikube later when needed, run: 'minikube start' or 'docker start minikube'."
else
    echo "  [OK] Minikube is not currently running."
fi

# Ensure 2 GB swap is active to prevent ML OOM killer during model load
SWAP_TOTAL_KB=$(free -k | awk '/^Swap:/ {print $2}')
if [ "${SWAP_TOTAL_KB:-0}" -lt 1048576 ]; then
    echo "  [ACTION] Setting up 2 GB swapfile to ensure safe TensorFlow model initialization..."
    if [ ! -f "/swapfile" ]; then
        sudo fallocate -l 2G /swapfile 2>/dev/null || sudo dd if=/dev/zero of=/swapfile bs=1M count=2048
        sudo chmod 600 /swapfile
        sudo mkswap /swapfile
    fi
    sudo swapon /swapfile 2>/dev/null || true
    echo "  [OK] 2 GB Swap activated."
else
    echo "  [OK] Swap already active (${SWAP_TOTAL_KB} KB)."
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

# Extract FRONTEND_PORT from .env (defaults to 80 if not specified)
TARGET_PORT=$(grep -E '^[[:space:]]*FRONTEND_PORT=' .env | head -n 1 | cut -d= -f2 | tr -d ' "\r' || true)
FRONTEND_PORT=${TARGET_PORT:-80}
echo "  Target frontend port: ${FRONTEND_PORT}"

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

echo "Checking TerraNex health probes on port ${FRONTEND_PORT}..."
MAX_RETRIES=15
RETRY=0
HEALTHY=false
while [ $RETRY -lt $MAX_RETRIES ]; do
    HTTP_HEALTH=$(curl -s -o /dev/null -w "%{http_code}" "http://127.0.0.1:${FRONTEND_PORT}/health" 2>/dev/null || echo "000")
    HTTP_ROOT=$(curl -s -o /dev/null -w "%{http_code}" "http://127.0.0.1:${FRONTEND_PORT}/" 2>/dev/null || echo "000")
    if [ "$HTTP_HEALTH" = "200" ] && [ "$HTTP_ROOT" = "200" ]; then
        echo "  [SUCCESS] TerraNex is healthy! (/health HTTP 200, / HTTP 200)"
        HEALTHY=true
        break
    fi
    echo "  Waiting for container healthchecks (Attempt ${RETRY}/${MAX_RETRIES}: /health=${HTTP_HEALTH}, /=${HTTP_ROOT})..."
    sleep 5
    RETRY=$((RETRY + 1))
done

if [ "$HEALTHY" != "true" ]; then
    echo "  [ERROR] Healthcheck timed out or failed. Container logs:"
    docker compose -f docker-compose.prod.yml logs --tail=30
    exit 1
fi

# Confirm AlzheimerML is still responsive
if sudo ss -tulpn | grep -q ":5001"; then
    echo "  [CONFIRMED] AlzheimerML is active and uninterrupted on port 5001."
fi

echo "===================================================================="
echo " TerraNex deployment completed successfully!"
echo " Web Application URL: http://$(curl -s http://checkip.amazonaws.com 2>/dev/null || echo '<EC2_PUBLIC_IP>'):${FRONTEND_PORT:-80}"
echo "===================================================================="
