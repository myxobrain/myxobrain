#!/usr/bin/env bash
# Deploy MYXOBRAIN (static) to the VPS: build, rsync deploy/dist to /var/www/$DOMAIN/html, Let's Encrypt, nginx from the template.
# Usage (from the myxobrain/ folder):  ./deploy/deploy.sh            (DOMAIN defaults to myxobrain.com)
# No pm2: nginx serves the files. /live/ on the VPS is protected so a forward-test job can publish live/live.json there.
set -euo pipefail
HOST=${HOST:-root@203.194.113.116}
DOMAIN=${DOMAIN:-myxobrain.com}
WWW=/var/www/$DOMAIN
SSH="ssh -o BatchMode=yes"
cd "$(dirname "$0")/.."

sh deploy/build.sh >/dev/null
$SSH "$HOST" "mkdir -p $WWW/html"
rsync -az --delete -e "$SSH" --filter="protect /live/" --exclude '.DS_Store' deploy/dist/ "$HOST:$WWW/html/"
rsync -az -e "$SSH" deploy/nginx.conf.tpl "$HOST:$WWW/nginx.conf.tpl"

$SSH "$HOST" "export LC_ALL=C.UTF-8; set -e
  CONF=/etc/nginx/conf.d/$DOMAIN.conf
  if [ ! -f /etc/letsencrypt/live/$DOMAIN/fullchain.pem ]; then
    # step 1: plain HTTP for the ACME challenge, then fetch the certificate
    printf 'server {\n  listen 80;\n  listen [::]:80;\n  server_name $DOMAIN www.$DOMAIN;\n  location /.well-known/acme-challenge/ { root $WWW; }\n  location / { return 404; }\n}\n' > \$CONF
    nginx -t -q && systemctl reload nginx
    certbot certonly --webroot -w $WWW -d $DOMAIN -d www.$DOMAIN --non-interactive --agree-tos --register-unsafely-without-email --keep-until-expiring -q \
      --deploy-hook 'systemctl reload nginx'
  fi
  sed 's/__DOMAIN__/$DOMAIN/g' $WWW/nginx.conf.tpl > \$CONF
  nginx -t -q && systemctl reload nginx && echo 'nginx ok'"
echo "deployed → https://$DOMAIN"
