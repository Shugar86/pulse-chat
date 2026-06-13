#!/bin/bash
set -e

data_path="./deploy/certbot"
email="admin@pulse.chat"

if [ ! -e "$data_path/conf/options-ssl-nginx.conf" ] || [ ! -e "$data_path/conf/ssl-dhparams.pem" ]; then
  mkdir -p "$data_path/conf"
  curl -s https://raw.githubusercontent.com/certbot/certbot/master/certbot-nginx/certbot_nginx/_internal/tls_configs/options-ssl-nginx.conf > "$data_path/conf/options-ssl-nginx.conf"
  curl -s https://raw.githubusercontent.com/certbot/certbot/master/certbot/certbot/ssl-dhparams.pem > "$data_path/conf/ssl-dhparams.pem"
fi

mkdir -p "$data_path/www/api.pulse.chat"

docker compose -f docker-compose.prod.yml up -d nginx

docker run -it --rm \
  -v "$PWD/deploy/certbot/conf:/etc/letsencrypt" \
  -v "$PWD/deploy/certbot/www:/var/www/certbot" \
  certbot/certbot certonly \
  --webroot -w /var/www/certbot \
  --email "$email" \
  -d api.pulse.chat \
  --agree-tos --non-interactive

docker compose -f docker-compose.prod.yml restart nginx
