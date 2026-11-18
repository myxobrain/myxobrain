# MYXOBRAIN studio

The owner panel at `https://myxobrain.com/studio`, the same panel and burn engine as OPTIC and WORMBRAIN.

- **Token:** save the `$MYXO` contract address. It then shows on myxobrain.com (header chip with copy and Buy on Pons, and the `burns.log` section).
- **Buyback wallet:** paste the private key of a fresh wallet that only holds ETH for buybacks. It is encrypted on the server (AES-256-GCM, key from `BURN_SECRET`) and never shown again.
- **Buyback and burn:** enter dollars; the panel buys `$MYXO` (Pons curve, or Uniswap v4 after graduation) and sends exactly what it bought to the dead address. Limits: `BURN_MAX_USD` per buyback, `BURN_DAY_USD` per 24 h.
- **Burn supply:** burns tokens already sent to the burn wallet, sized in dollars or Max.

The studio key is generated on first start into `studio/data/burn/secrets.json` on the server (or set `STUDIO_KEY` in `studio/.env`). Read it with:

    ssh root@203.194.113.116 "node -e 'console.log(require(\"/var/www/myxobrain.com/studio/data/burn/secrets.json\").studioKey)'"

Runs as pm2 app `myxobrain-studio` on 127.0.0.1:5770; nginx sends only `/studio` and `/api/` to it. `deploy/deploy.sh` syncs it and never touches `studio/data` or `studio/.env`. Public feed: `GET /api/token`.
