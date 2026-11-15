# nginx · __DOMAIN__ (MYXOBRAIN, static) over HTTPS, installed after
#   certbot certonly --webroot -w /var/www/__DOMAIN__ -d __DOMAIN__ -d www.__DOMAIN__
# The SNI router on :443 (stream block in nginx.conf) forwards every unlisted name to 127.0.0.1:8443 with PROXY protocol.
# The site is the output of deploy/build.sh, rsynced to /var/www/__DOMAIN__/html. No app server.
server {
    listen 127.0.0.1:8443 ssl proxy_protocol;
    server_name __DOMAIN__ www.__DOMAIN__;
    ssl_certificate /etc/letsencrypt/live/__DOMAIN__/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/__DOMAIN__/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;
    client_max_body_size 64k;
    server_tokens off; absolute_redirect off;   # behind the SNI router on :8443, so never put the port in a redirect

    root /var/www/__DOMAIN__/html;
    index index.html;

    # data files must 404 when missing (e.g. live/live.json before the forward test publishes), never fall back to the page
    location ~* \.(json|ots)$ {
        try_files $uri =404;
        add_header Cache-Control "no-cache";
    }
    location ~* \.(png|ico|svg|webp|woff2)$ {
        try_files $uri =404;
        expires 7d;
    }
    location / {
        try_files $uri $uri.html $uri/ /index.html;   # .html before the folder: data/ and live/ are folders as well as pages
    }
}
server {
    listen 80;
    listen [::]:80;
    server_name __DOMAIN__ www.__DOMAIN__;
    location /.well-known/acme-challenge/ { root /var/www/__DOMAIN__; }
    location / { return 301 https://$host$request_uri; }
}
