#!/bin/bash
# start.sh — Deploy latest code from GitHub and restart the app
# Run from the project root on the server: bash start.sh

set -e

APP_DIR="/var/www/garage56"
cd "$APP_DIR"

# Load NVM
export NVM_DIR="$HOME/.nvm"
source "$NVM_DIR/nvm.sh"

echo "=== Deploying Garage 56 ==="

echo "[1/4] Pulling latest code..."
git pull origin main

echo "[2/4] Installing frontend dependencies..."
npm install

echo "[3/4] Building frontend..."
npm run build

echo "[4/4] Updating backend and restarting..."
cd server
npm install
pm2 restart garage56-api --update-env
cd ..

echo ""
echo "=== Deploy complete! ==="
pm2 status garage56-api
