#!/bin/bash
# setup.sh — First-time server setup for Garage 56
# Run once on a fresh Ubuntu/Debian server as root or with sudo

set -e

APP_DIR="/var/www/garage56"
DB_NAME="garage56"
DB_USER="garage56"
REPO_URL="https://github.com/animuray/Garage-56.git"
FRONTEND_URL="https://garage56.online"

echo "=== Garage 56 Server Setup ==="

# ── 1. System packages ──────────────────────────────────────────────────────
echo "[1/8] Installing system packages..."
apt-get update -qq
apt-get install -y curl git build-essential

# ── 2. Node.js via NVM ──────────────────────────────────────────────────────
echo "[2/8] Installing Node.js 20 via NVM..."
export NVM_DIR="$HOME/.nvm"
if [ ! -d "$NVM_DIR" ]; then
  curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
fi
source "$NVM_DIR/nvm.sh"
nvm install 20
nvm use 20
nvm alias default 20
echo "Node: $(node -v), NPM: $(npm -v)"

npm install -g pm2

# ── 3. PostgreSQL ────────────────────────────────────────────────────────────
echo "[3/8] Installing PostgreSQL..."
apt-get install -y postgresql postgresql-contrib
systemctl enable postgresql
systemctl start postgresql

# ── 4. Database & user ──────────────────────────────────────────────────────
echo "[4/8] Creating database and user..."
read -s -p "Enter password for DB user '$DB_USER': " DB_PASSWORD
echo ""

sudo -u postgres psql -c "CREATE USER $DB_USER WITH PASSWORD '$DB_PASSWORD';" 2>/dev/null || \
  sudo -u postgres psql -c "ALTER USER $DB_USER WITH PASSWORD '$DB_PASSWORD';"

sudo -u postgres psql -c "CREATE DATABASE $DB_NAME OWNER $DB_USER;" 2>/dev/null || \
  echo "Database '$DB_NAME' already exists, skipping."

sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE $DB_NAME TO $DB_USER;"

# ── 5. Clone repository ─────────────────────────────────────────────────────
echo "[5/8] Cloning repository..."
mkdir -p "$APP_DIR"
if [ -d "$APP_DIR/.git" ]; then
  echo "Repo already cloned, pulling latest..."
  git -C "$APP_DIR" pull origin main
else
  git clone "$REPO_URL" "$APP_DIR"
fi

cd "$APP_DIR"

# ── 6. Environment file ─────────────────────────────────────────────────────
echo "[6/8] Setting up environment..."
if [ ! -f "server/.env" ]; then
  cp .env.example server/.env
  JWT_SECRET=$(openssl rand -hex 32)
  sed -i "s|change_me_to_a_random_secret_string|$JWT_SECRET|" server/.env
  sed -i "s|change_me_to_strong_password|$DB_PASSWORD|" server/.env
  sed -i "s|DB_USER=garage56|DB_USER=$DB_USER|" server/.env
  sed -i "s|DB_NAME=garage56|DB_NAME=$DB_NAME|" server/.env
  sed -i "s|FRONTEND_URL=https://yourdomain.com|FRONTEND_URL=$FRONTEND_URL|" server/.env
else
  echo "server/.env already exists, skipping."
fi

# ── 7. Install dependencies ─────────────────────────────────────────────────
echo "[7/8] Installing dependencies..."
npm install
cd server && npm install && cd ..

# ── 7b. Run schema and migrations ───────────────────────────────────────────
echo "Applying database schema..."
PGPASSWORD="$DB_PASSWORD" psql -h localhost -U "$DB_USER" -d "$DB_NAME" -f database/schema.sql
for f in database/migrations/*.sql; do
  echo "  Applying $f..."
  PGPASSWORD="$DB_PASSWORD" psql -h localhost -U "$DB_USER" -d "$DB_NAME" -f "$f"
done

# ── 7c. Create owner user ────────────────────────────────────────────────────
echo ""
echo "=== Create Owner Account ==="
read -p "Owner name: " OWNER_NAME
read -p "Owner email: " OWNER_EMAIL
read -p "Owner phone (optional, press Enter to skip): " OWNER_PHONE
read -s -p "Owner password: " OWNER_PASSWORD
echo ""
read -s -p "Confirm password: " OWNER_PASSWORD2
echo ""

if [ "$OWNER_PASSWORD" != "$OWNER_PASSWORD2" ]; then
  echo "ERROR: Passwords do not match. Aborting."
  exit 1
fi

node - <<EOF
const bcrypt = require('./server/node_modules/bcryptjs')
const { Pool } = require('./server/node_modules/pg')
require('./server/node_modules/dotenv').config({ path: './server/.env' })

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'garage56',
  user: process.env.DB_USER || 'garage56',
  password: process.env.DB_PASSWORD,
});

(async () => {
  const hash = await bcrypt.hash('$OWNER_PASSWORD', 10)
  const phone = '$OWNER_PHONE' || null
  await pool.query(
    \`INSERT INTO employees (name, email, password_hash, role, phone, is_active)
     VALUES (\$1, \$2, \$3, 'owner', \$4, true)
     ON CONFLICT (email) DO UPDATE
       SET password_hash = EXCLUDED.password_hash,
           name = EXCLUDED.name,
           role = 'owner',
           is_active = true\`,
    ['$OWNER_NAME', '$OWNER_EMAIL', hash, phone || null]
  )
  console.log('Owner account created: $OWNER_EMAIL')
  await pool.end()
})().catch(e => { console.error('Error:', e.message); process.exit(1) })
EOF

# ── 8. Build frontend & start ───────────────────────────────────────────────
echo "[8/8] Building frontend..."
npm run build

echo "Starting backend with PM2..."
cd server
pm2 delete garage56-api 2>/dev/null || true
pm2 start server.js --name garage56-api
pm2 save
pm2 startup | tail -1 | bash 2>/dev/null || true
cd ..

echo ""
echo "=== Setup complete! ==="
echo "  Domain:   $FRONTEND_URL"
echo "  Backend:  http://localhost:3001"
echo "  Frontend: $APP_DIR/dist/"
echo "  Owner:    $OWNER_EMAIL"
echo ""
echo "Next step: configure nginx"
echo "  See: https://garage56.online → nginx должен раздавать dist/ и проксировать /api на :3001"
