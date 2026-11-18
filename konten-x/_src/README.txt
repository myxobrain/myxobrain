MYXOBRAIN · X content kit (same layout as optic/konten-x)
=========================================================

konten-x/
  captions.txt   every caption, in posting order: pre-launch, launch (CA), after launch, milestones, research series
  pre/           01-06 pre-launch posts (1600x900, no CA)
  post/          01-20 after-launch posts (cinematic Hugging Face stills or site screenshots)
  paper/         01-32 MYXO PAPER research cards (1920x1080), one paper per card
  video/         myxobrain-ca.mp4         CA post: intro card + real screen recording of myxobrain.com + end card
                 myxobrain-dex.mp4        market cap reaches $20K and DEX Screener is paid
                 myxobrain-burn.mp4       dev wallet burns its whole supply
                 myxobrain-morph / explainer / papers / specimen-<organism>.mp4
  _src/          templates and tools (below), plus inputs: hf/ (Hugging Face stills), product/ (site screenshots)

brand/ (repo root, like optic/brand)
  MYXOBRAIN-X/   banner-1500x500, banner-3000x1000, logo-profile, logo-*-transparent, bio.txt (X profile + narrative)
  logo/          favicon.ico, favicon-32, apple-touch-icon-180, avatar-800, logo-amber/white/black
  github-social-1280x640.png, og-1200x630.png, brand-copy.txt (tagline, GitHub/npm text, colors)

Re-render (from myxobrain/, after sh deploy/build.sh):
  node konten-x/_src/plates.mjs [ids]          Hugging Face stills into _src/hf/ (Z-Image Turbo)
  node konten-x/_src/stills.mjs [banner,cards,product,posts]   banner, paper/ cards, _src/product/ screenshots
  node konten-x/_src/posts.mjs [p01 a02 ...]   pre/ and post/ images from posts.html (file names in names.json)
  node konten-x/_src/film.mjs <scene>          video/myxobrain-<scene>.mp4 from film.html:
                                               caintro caoutro paydex burn morph explainer papers specimen-<org>
                                               (paydex -> rename to myxobrain-dex.mp4)
  node konten-x/_src/record.mjs                video/myxobrain-ca.mp4 (records myxobrain.com; SITE=... for another host)
Ticker: $MYXO by default. TICKER='$XYZ' before posts.mjs / film.mjs / record.mjs to change it.
