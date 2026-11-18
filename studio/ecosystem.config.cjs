// pm2 process file · `pm2 startOrRestart ecosystem.config.cjs --update-env` (deploy/deploy.sh does this)
const path = require("node:path");
module.exports = {
  apps: [{
    name: "myxobrain-studio",
    cwd: __dirname,
    script: "server.mjs",
    node_args: "--env-file-if-exists=.env --max-old-space-size=120",
    env: { NODE_ENV: "production", PORT: 5770, HOST: "127.0.0.1" },
    max_memory_restart: "180M",   // the VPS runs ~60 apps; this one only waits for the owner
    time: true,
    autorestart: true,
    max_restarts: 20,
  }],
};
