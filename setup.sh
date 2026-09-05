#!/bin/bash
# setup.sh — First-time server setup for Garage 56
# Run once on a fresh Ubuntu/Debian server as root or with sudo

set -e

APP_DIR="/var/www/garage56"
DB_NAME="garage56"
DB_USER="garage56"
REPO_URL="https://github.com/animuray/Garage-56.git"
DOMAIN="garage56.online"
FRONTEND_URL="https://$DOMAIN"

echo "=== Garage 56 Server Setup ==="

# ── 1. System packages ──────────────────────────────────────────────────────
echo "[1/9] Installing system packages..."
apt-get update -qq
apt-get install -y curl git build-essential nginx certbot python3-certbot-nginx

# ── 2. Node.js via NVM ──────────────────────────────────────────────────────
echo "[2/9] Installing Node.js 20 via NVM..."
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
echo "[3/9] Installing PostgreSQL..."
apt-get install -y postgresql postgresql-contrib
systemctl enable postgresql
systemctl start postgresql

# ── 4. Database & user ──────────────────────────────────────────────────────
echo "[4/9] Creating database and user..."
read -s -p "Enter password for DB user '$DB_USER': " DB_PASSWORD
echo ""

sudo -u postgres psql -c "CREATE USER $DB_USER WITH PASSWORD '$DB_PASSWORD';" 2>/dev/null || \
  sudo -u postgres psql -c "ALTER USER $DB_USER WITH PASSWORD '$DB_PASSWORD';"

sudo -u postgres psql -c "CREATE DATABASE $DB_NAME OWNER $DB_USER;" 2>/dev/null || \
  echo "Database '$DB_NAME' already exists, skipping."

sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE $DB_NAME TO $DB_USER;"

# ── 5. Clone repository ─────────────────────────────────────────────────────
echo "[5/9] Cloning repository..."
mkdir -p "$APP_DIR"
if [ -d "$APP_DIR/.git" ]; then
  echo "Repo already cloned, pulling latest..."
  git -C "$APP_DIR" pull origin main
else
  git clone "$REPO_URL" "$APP_DIR"
fi

cd "$APP_DIR"

# ── 6. Environment file ─────────────────────────────────────────────────────
echo "[6/9] Setting up environment..."
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
echo "[7/9] Installing dependencies..."
npm install
cd server && npm install && cd ..

# ── 7b. Run schema and migrations ───────────────────────────────────────────
echo "Applying database schema..."
PGPASSWORD="$DB_PASSWORD" psql -h localhost -U "$DB_USER" -d "$DB_NAME" -f database/schema.sql
for f in database/migrations/*.sql; do
  echo "  Applying $f..."
  PGPASSWORD="$DB_PASSWORD" psql -h localhost -U "$DB_USER" -d "$DB_NAME" -f "$f"
done

# ── 7c. Create owner account ─────────────────────────────────────────────────
echo ""
echo "=== Create Owner Account ==="
read -p "Your name: " OWNER_NAME
read -p "Your email: " OWNER_EMAIL
read -p "Your phone (optional, press Enter to skip): " OWNER_PHONE
read -s -p "Password: " OWNER_PASSWORD
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
  host:     process.env.DB_HOST     || 'localhost',
  port:     parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME     || 'garage56',
  user:     process.env.DB_USER     || 'garage56',
  password: process.env.DB_PASSWORD,
});

(async () => {
  const hash  = await bcrypt.hash('$OWNER_PASSWORD', 10)
  const phone = '$OWNER_PHONE'.trim() || null
  await pool.query(
    \`INSERT INTO employees (name, email, password_hash, role, phone, is_active)
     VALUES (\$1, \$2, \$3, 'owner', \$4, true)
     ON CONFLICT (email) DO UPDATE
       SET password_hash = EXCLUDED.password_hash,
           name          = EXCLUDED.name,
           role          = 'owner',
           is_active     = true\`,
    ['$OWNER_NAME', '$OWNER_EMAIL', hash, phone]
  )
  console.log('Owner account created: $OWNER_EMAIL')
  await pool.end()
})().catch(e => { console.error('Error:', e.message); process.exit(1) })
EOF

# ── 8. Build frontend & start backend ───────────────────────────────────────
echo "[8/9] Building frontend..."
npm run build

echo "Starting backend with PM2..."
cd server
pm2 delete garage56-api 2>/dev/null || true
pm2 start server.js --name garage56-api
pm2 save
pm2 startup | tail -1 | bash 2>/dev/null || true
cd ..

# ── 9. Nginx + SSL ──────────────────────────────────────────────────────────
echo "[9/9] Configuring nginx..."

# Write HTTP-only config first (certbot needs port 80 to verify domain)
cat > /etc/nginx/sites-available/garage56 << NGINX
server {
    listen 80;
    server_name $DOMAIN www.$DOMAIN;

    root $APP_DIR/dist;
    index index.html;

    # Backend API
    location /api/ {
        proxy_pass         http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header   Host              \$host;
        proxy_set_header   X-Real-IP         \$remote_addr;
        proxy_set_header   X-Forwarded-For   \$proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto \$scheme;
        proxy_read_timeout 60s;
    }

    # Uploaded files (logos, icons)
    location /uploads/ {
        proxy_pass http://127.0.0.1:3001;
    }

    # SPA — all unknown routes → index.html
    location / {
        try_files \$uri \$uri/ /index.html;
    }
}
NGINX

# Enable site
ln -sf /etc/nginx/sites-available/garage56 /etc/nginx/sites-enabled/garage56
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx

echo ""
echo "Nginx is running on http://$DOMAIN"
echo ""

# SSL via Let's Encrypt
read -p "Get SSL certificate now? DNS must already point to this server. (y/N): " GET_SSL
if [[ "$GET_SSL" =~ ^[Yy]$ ]]; then
  read -p "Email for SSL certificate notifications: " SSL_EMAIL
  certbot --nginx \
    -d "$DOMAIN" \
    -d "www.$DOMAIN" \
    --non-interactive \
    --agree-tos \
    -m "$SSL_EMAIL"
  echo "SSL certificate installed."
else
  echo "Skipped SSL. Run later:"
  echo "  certbot --nginx -d $DOMAIN -d www.$DOMAIN"
fi

echo ""
echo "=== Setup complete! ==="
echo "  Site:    $FRONTEND_URL"
echo "  API:     http://127.0.0.1:3001 (internal only)"
echo "  Owner:   $OWNER_EMAIL"
echo "  PM2:     pm2 status"
echo "  Logs:    pm2 logs garage56-api"
echo "  Deploy:  bash $APP_DIR/start.sh"
