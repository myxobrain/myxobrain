MYXOBRAIN · X content kit (projek-token/myxobrain/konten-x)

Ready to post
  prelaunch/        p01-p06.png               pre-launch posts
  postingan-ca/     ca-demo.mp4               CA post: intro card + real screen recording of myxobrain.com + end card
  afterlaunch/      a01-a20.png               after-launch posts (cinematic Hugging Face stills or site screenshots)
  video/            morph, explainer, papers, specimen-physarum/worm/fry/ant/bee/ecoli .mp4
  research/         01-32 MYXO PAPER cards    the research series, one paper per card (captions in POSTS.txt)
  paydex/           paydex-20k.mp4            when market cap reaches $20K and DEX Screener is paid
  burn/             burn-all-supply.mp4       after the dev wallet burns its whole supply
  product/          screenshots of myxobrain.com used by the posts and POSTS.txt
  myxobrain-x-kit/  banner, profile picture, logos, bio
  captions.txt      captions for prelaunch, CA, afterlaunch, videos, milestones, and the posting order
  POSTS.txt         the MYXO PAPER research series (R01-R32) and product posts (P01-P14)
  BIO.txt           X profile: name, bio options, location, website

Re-render (from myxobrain/, after sh deploy/build.sh; tools serve the build at / and this folder at /kit/)
  node konten-x/_tools/plates.mjs [ids]          Hugging Face stills into _hf/ (Z-Image Turbo; HF=flux for FLUX.1-dev)
  node konten-x/_src/render.mjs [banner,cards,product,posts]   research cards, X banner, site screenshots, POSTS.txt
  node konten-x/_tools/posts.mjs [p01 a02 ...]   post images from _p.html
  node konten-x/_tools/render.mjs <scene>        videos from _v.html: caintro caoutro paydex burn morph explainer papers specimen-<org>
  node konten-x/_tools/demo.mjs                  CA video: records myxobrain.com (SITE=... for another host)
  TICKER='$XYZ' before render/demo/posts if the ticker is not $MYXO.
Hugging Face's free GPU quota runs out after ~10 stills a day; plates.mjs skips stills it already has, so just run it again.
A post whose still is missing falls back to the live 3D specimen.
