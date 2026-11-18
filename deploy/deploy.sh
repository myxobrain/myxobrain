#!/usr/bin/env bash
# Deploy MYXOBRAIN to the VPS: build, rsync deploy/dist to /var/www/$DOMAIN/html, the studio server to /var/www/$DOMAIN/studio
# (pm2 app myxobrain-studio, :5770), Let's Encrypt, nginx from the template.
# Usage (from the myxobrain/ folder):  ./deploy/deploy.sh            (DOMAIN defaults to myxobrain.com)
# nginx serves the site; only /studio and /api/ reach the studio server. /live/ on the VPS is protected so a forward-test job can
# publish live/live.json there. studio/data (the studio key, the encrypted buyback wallet, burn history) and studio/.env live only
# on the VPS and are never synced or overwritten.
set -euo pipefail
HOST=${HOST:-root@203.194.113.116}
DOMAIN=${DOMAIN:-myxobrain.com}
WWW=/var/www/$DOMAIN
SSH="ssh -o BatchMode=yes"
cd "$(dirname "$0")/.."

sh deploy/build.sh >/dev/null
$SSH "$HOST" "mkdir -p $WWW/html"
rsync -az --delete -e "$SSH" --filter="protect /live/" --exclude '.DS_Store' deploy/dist/ "$HOST:$WWW/html/"
rsync -az -e "$SSH" deploy/nginx.conf.tpl deploy/studio-proxy.conf "$HOST:$WWW/"
$SSH "$HOST" "mkdir -p $WWW/studio/data && chmod 700 $WWW/studio/data"
rsync -az --delete -e "$SSH" --filter="protect /node_modules/" --filter="protect /data/" --filter="protect /.env" \
  --exclude node_modules --exclude '/data/' --exclude /.env --exclude '.DS_Store' studio/ "$HOST:$WWW/studio/"
$SSH "$HOST" "export LC_ALL=C.UTF-8; set -e
  cd $WWW/studio && npm install --omit=dev --no-audit --no-fund >/dev/null
  pm2 startOrRestart ecosystem.config.cjs --update-env >/dev/null && pm2 save >/dev/null
  for i in \$(seq 1 20); do sleep 1; curl -fsS -o /dev/null http://127.0.0.1:5770/api/health 2>/dev/null && echo 'studio up on :5770' && break; done"

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
