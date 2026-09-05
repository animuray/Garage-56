#!/bin/bash
# setup.sh — First-time server setup for Garage 56
# Run once on a fresh Ubuntu/Debian server as root or with sudo

set -e

APP_DIR="/var/www/garage56"
DB_NAME="garage56"
DB_USER="garage56"
REPO_URL="https://github.com/animuray/Garage-56.git"

echo "=== Garage 56 Server Setup ==="

# ── 1. System packages ──────────────────────────────────────────────────────
echo "[1/7] Installing system packages..."
apt-get update -qq
apt-get install -y curl git build-essential

# ── 2. Node.js via NVM ──────────────────────────────────────────────────────
echo "[2/7] Installing Node.js 20 via NVM..."
export NVM_DIR="$HOME/.nvm"
if [ ! -d "$NVM_DIR" ]; then
  curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
fi
source "$NVM_DIR/nvm.sh"
nvm install 20
nvm use 20
nvm alias default 20
echo "Node: $(node -v), NPM: $(npm -v)"

# PM2
npm install -g pm2

# ── 3. PostgreSQL ────────────────────────────────────────────────────────────
echo "[3/7] Installing PostgreSQL..."
apt-get install -y postgresql postgresql-contrib
systemctl enable postgresql
systemctl start postgresql

# ── 4. Database & user ──────────────────────────────────────────────────────
echo "[4/7] Creating database and user..."
read -s -p "Enter password for DB user '$DB_USER': " DB_PASSWORD
echo ""

sudo -u postgres psql -c "CREATE USER $DB_USER WITH PASSWORD '$DB_PASSWORD';" 2>/dev/null || \
  sudo -u postgres psql -c "ALTER USER $DB_USER WITH PASSWORD '$DB_PASSWORD';"

sudo -u postgres psql -c "CREATE DATABASE $DB_NAME OWNER $DB_USER;" 2>/dev/null || \
  echo "Database '$DB_NAME' already exists, skipping."

sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE $DB_NAME TO $DB_USER;"

# ── 5. Clone repository ─────────────────────────────────────────────────────
echo "[5/7] Cloning repository..."
mkdir -p "$APP_DIR"
if [ -d "$APP_DIR/.git" ]; then
  echo "Repo already cloned, pulling latest..."
  git -C "$APP_DIR" pull origin main
else
  git clone "$REPO_URL" "$APP_DIR"
fi

cd "$APP_DIR"

# ── 6. Environment file ─────────────────────────────────────────────────────
echo "[6/7] Setting up environment..."
if [ ! -f "server/.env" ]; then
  cp .env.example server/.env
  
  JWT_SECRET=$(openssl rand -hex 32)
  
  sed -i "s|change_me_to_a_random_secret_string|$JWT_SECRET|g" server/.env
  sed -i "s|change_me_to_strong_password|$DB_PASSWORD|g" server/.env
  sed -i "s|DB_USER=garage56|DB_USER=$DB_USER|g" server/.env
  sed -i "s|DB_NAME=garage56|DB_NAME=$DB_NAME|g" server/.env
  
  echo ""
  echo "IMPORTANT: Edit server/.env and set FRONTEND_URL to your domain!"
  echo "  nano $APP_DIR/server/.env"
  echo ""
else
  echo "server/.env already exists, skipping."
fi

# ── 6b. Run migrations ──────────────────────────────────────────────────────
echo "Running database schema and migrations..."
PGPASSWORD="$DB_PASSWORD" psql -h localhost -U "$DB_USER" -d "$DB_NAME" -f database/schema.sql
for f in database/migrations/*.sql; do
  echo "  Applying $f..."
  PGPASSWORD="$DB_PASSWORD" psql -h localhost -U "$DB_USER" -d "$DB_NAME" -f "$f"
done

# ── 7. Install deps & build ─────────────────────────────────────────────────
echo "[7/7] Installing dependencies and building..."
npm install
npm run build
cd server && npm install && cd ..

# ── PM2 setup ───────────────────────────────────────────────────────────────
echo "Starting backend with PM2..."
cd server
pm2 delete garage56-api 2>/dev/null || true
pm2 start server.js --name garage56-api --env production
pm2 save
pm2 startup | tail -1 | bash 2>/dev/null || true
cd ..

echo ""
echo "=== Setup complete! ==="
echo "  Backend:  http://localhost:3001"
echo "  Frontend: $APP_DIR/dist/ (serve with nginx)"
echo ""
echo "Next steps:"
echo "  1. Edit server/.env → set FRONTEND_URL"
echo "  2. Configure nginx to serve dist/ and proxy /api to :3001"
echo "  3. Point your domain DNS to this server"
