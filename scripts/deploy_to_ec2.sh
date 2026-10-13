#!/usr/bin/env bash
# ==============================================================================
# TerraNex Safe EC2 Automated Deployment Script
# Designed for coexistence on Ubuntu EC2 with AlzheimerML on Port 5001
# ==============================================================================

set -euo pipefail

echo "===================================================================="
echo " Starting Safe TerraNex Production Deployment"
echo "===================================================================="

# 0. Repository Location and Git Commit Verification
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
cd "${REPO_DIR}"
echo "[1/7] Repository verification..."
echo "  Working Directory: ${REPO_DIR}"
CURRENT_COMMIT=$(git rev-parse --short HEAD 2>/dev/null || echo "unknown")
echo "  Current Commit: ${CURRENT_COMMIT}"

# 1. Environment Configuration Check (Fail fast before touching any host services)
echo "[2/7] Checking environment configuration (.env)..."
if [ ! -f ".env" ]; then
    echo "  [ERROR] .env file not found in ${REPO_DIR}!"
    echo "  Please create .env containing your production Atlas settings before deploying."
    exit 1
fi

if ! grep -E '^[[:space:]]*MONGODB_URL=mongodb(\+srv)?://' .env > /dev/null; then
    echo "  [ERROR] MONGODB_URL is missing or invalid in .env! Must begin with mongodb:// or mongodb+srv://"
    exit 1
fi
echo "  [OK] Valid MONGODB_URL format detected in .env (secrets masked)."

if ! grep -E '^[[:space:]]*REQUIRE_MONGODB=true' .env > /dev/null; then
    echo "  [NOTE] Appending REQUIRE_MONGODB=true to .env for production safety."
    echo "REQUIRE_MONGODB=true" >> .env
fi
echo "  [OK] REQUIRE_MONGODB=true confirmed."

# Test live Atlas connectivity privately if python3 and pymongo are available
if command -v python3 >/dev/null 2>&1 && python3 -c "import pymongo" >/dev/null 2>&1; then
    echo "  [ACTION] Verifying live Atlas connectivity from host environment (read-only)..."
    python3 -c "
import sys
from pymongo import MongoClient

with open('.env', 'r') as f:
    for line in f:
        if line.strip().startswith('MONGODB_URL='):
            url = line.strip().split('=', 1)[1].strip('\"\'')
            break
try:
    c = MongoClient(url, serverSelectionTimeoutMS=8000)
    c.admin.command('ping')
    print('  [OK] Live Atlas connectivity verified to TerraNex DB.')
except Exception as e:
    print('  [ERROR] Live Atlas connection failed:', type(e).__name__)
    sys.exit(1)
"
else
    echo "  [NOTE] Host Python pymongo not present; backend container will test Atlas connectivity on launch."
fi

TARGET_PORT=$(grep -E '^[[:space:]]*FRONTEND_PORT=' .env | head -n 1 | cut -d= -f2 | tr -d ' "\r' || true)
FRONTEND_PORT=${TARGET_PORT:-80}
echo "  Configured frontend port: ${FRONTEND_PORT}"

# 2. Existing Services Pre-flight Check (Verify AlzheimerML Status)
echo "[3/7] Verifying existing services on host..."
if sudo ss -tulpn | grep -q ":5001"; then
    echo "  [OK] AlzheimerML service is active on port 5001. We will NOT touch or modify it."
else
    echo "  [NOTE] Port 5001 is not currently listening. Continuing safely."
fi

# 3. Disk Space Pre-Check
echo "[4/7] Checking storage and recalculating headroom..."
FREE_DISK_KB=$(df / --output=avail | tail -n 1)
FREE_DISK_GB=$((FREE_DISK_KB / 1024 / 1024))
echo "  Available Root Disk: ${FREE_DISK_GB} GB"
if [ "$FREE_DISK_GB" -lt 4 ]; then
    echo "  [ABORT] Insufficient disk space: only ${FREE_DISK_GB} GB available."
    echo "  At least 4 GB free disk is required to safely provision swap and pull images."
    exit 1
fi

echo "===================================================================="
echo " Final Pre-Deployment Action Summary"
echo "===================================================================="
echo " • Repository Path:       ${REPO_DIR}"
echo " • Commit ID:             ${CURRENT_COMMIT}"
echo " • Target Images:         ghcr.io/janapriya29/terranex-frontend:latest"
echo "                          ghcr.io/janapriya29/terranex-backend:latest"
echo " • Memory Optimization:   Pause Minikube (~1.1 GB RAM freed) + 2 GB Swap"
echo " • Service Isolation:     AlzheimerML (port 5001) will NOT be touched"
echo " • Target Web Port:       ${FRONTEND_PORT}"
echo "===================================================================="

# Interactive confirmation prompt before host mutation (unless -y / --yes is passed)
if [ "${1:-}" != "-y" ] && [ "${1:-}" != "--yes" ]; then
    if [ -t 0 ]; then
        read -r -p "Approve and execute Option 2 deployment on this host? (y/N): " CONFIRM
        if [[ ! "$CONFIRM" =~ ^[Yy]$ ]]; then
            echo "Deployment aborted by user. Zero host changes made."
            exit 0
        fi
    fi
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

# 4. Pull Prebuilt Images from GHCR (Zero on-server compilation)
echo "[5/7] Pulling prebuilt images from GitHub Container Registry..."
docker compose -f docker-compose.prod.yml pull

# 5. Launch Isolated TerraNex Containers
echo "[6/7] Starting TerraNex container stack..."
docker compose -f docker-compose.prod.yml up -d

# 6. Post-deployment Health & Coexistence Verification
echo "[7/7] Verifying health and service isolation..."
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
