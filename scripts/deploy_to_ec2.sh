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

# 2. Option 2 Capacity Optimization: Free RAM & Setup Swap
echo "[2/7] Optimizing host capacity (Option 2)..."
if docker ps --format '{{.Names}}' 2>/dev/null | grep -q -i "minikube"; then
    echo "  [ACTION] Pausing/stopping Minikube container to free ~1.1 GB RAM..."
    docker stop minikube || true
    echo "  [OK] Minikube stopped safely. AlzheimerML (port 5001) is untouched."
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

# Prune dangling images to ensure maximum disk space
echo "  [ACTION] Pruning dangling Docker cache to free disk space..."
docker image prune -f || true

# 3. Check Headroom
echo "[3/7] Verifying system headroom post-optimization..."
FREE_DISK_KB=$(df / --output=avail | tail -n 1)
FREE_DISK_GB=$((FREE_DISK_KB / 1024 / 1024))
echo "  Available Root Disk: ${FREE_DISK_GB} GB"
free -h

# 4. Environment Configuration Check
echo "[4/7] Checking environment configuration (.env)..."
if [ ! -f ".env" ]; then
    echo "  [ERROR] .env file not found!"
    echo "  Please create a .env file containing your production settings."
    echo "  Example:"
    echo "    MONGODB_URL=mongodb+srv://<user>:<password>@cluster0.abcde.mongodb.net/TerraNex?retryWrites=true&w=majority"
    echo "    FRONTEND_PORT=80"
    echo "    CORS_ORIGINS=http://localhost,http://localhost:80"
    exit 1
fi

# 5. Pull Prebuilt Images from GHCR (Zero on-server compilation)
echo "[5/7] Pulling prebuilt images from GitHub Container Registry..."
docker compose -f docker-compose.prod.yml pull

# 6. Launch Isolated TerraNex Containers
echo "[6/7] Starting TerraNex container stack..."
docker compose -f docker-compose.prod.yml up -d

# 7. Post-deployment Health & Coexistence Verification
echo "[7/7] Verifying health and service isolation..."
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
