// node konten-x/_tools/plates.mjs [ids]: cinematic stills from Hugging Face into _hf/<id>.webp (Z-Image Turbo space;
// HF=flux for FLUX.1-dev while the account has ZeroGPU quota). The MYXOBRAIN world: a dark lab at night, warm amber light,
// living specimens under glass. No text, no logos, no faces. Same token and client the PRYSM kit uses.
import { Client } from "/Users/sergiodyegogmail.com/Documents/projek-token/melos/brand/hf/node_modules/@gradio/client/dist/index.js";
import fs from "node:fs"; import path from "node:path";
import { KIT } from "./lib.mjs";
const OUT = path.join(KIT, "_hf"); fs.mkdirSync(OUT, { recursive: true });
const token = fs.readFileSync("/Users/sergiodyegogmail.com/Documents/projek-token/melos/.hf-token", "utf8").trim();
const STYLE = "cinematic scientific fine-art photograph, near black background, warm amber key light, deep shadows, chiaroscuro, macro lens, shallow depth of field, anamorphic wide shot, subtle film grain, ultra detailed, no text, no letters, no numbers, no logo, no watermark, no faces, no people";
const SHOTS = {
  petri: "a glass petri dish on black glass lit from below by warm amber light, a branching yellow slime mold network spreading across dark agar",
  slime: "macro of a bright yellow slime mold made of thick and thin tubes connecting small oat flakes on dark agar, glistening, warm rim light",
  city: "top down view of a glowing amber slime mold network linking points of light scattered like cities over a dark textured surface",
  worm: "a translucent microscopic nematode worm curved in a loose S shape in black liquid, faint glowing amber nerve fibres inside its body, dark field microscopy",
  fry: "a tiny transparent zebrafish larva floating in black water, its brain glowing with small amber points of light, macro, dark field",
  ants: "a single file of ants walking across black stone along a faint glowing amber trail, macro, low angle",
  swarm: "a dense cluster of honeybees hanging from a dark branch, warm amber backlight glowing through their wings, dusk",
  comb: "macro of hexagonal honeycomb cells glowing amber in darkness, a few bees at the edge out of focus",
  bacteria: "rod shaped bacteria with long thin flagella swimming in dark fluid, electron microscopy look, amber highlights, depth of field",
  scope: "an old brass laboratory microscope on a black desk, a single warm amber lamp, dust floating in the light, dark lab at night",
  jars: "six glowing glass specimen jars in a row on a long dark laboratory table, each lit from within by warm amber light, fog",
  ember: "glowing amber embers and molten gold dissolving into darkness, sparks rising slowly, black background",
  vault: "a sealed glass laboratory cabinet in darkness, warm amber light leaking through the edges of its door, dust in the air",
  dawn: "a dark laboratory window at dawn, warm amber light falling across petri dishes and glassware on a bench",
};
const ids = process.argv[2] ? process.argv[2].split(",") : Object.keys(SHOTS);
const FLUX = process.env.HF === "flux";
const client = FLUX ? await Client.connect("black-forest-labs/FLUX.1-dev", { token }) : await Client.connect("Tongyi-MAI/Z-Image-Turbo", { token });
for (const id of ids) {
  if (fs.existsSync(path.join(OUT, `${id}.webp`))) { console.log("have", id); continue; }
  const t = Date.now();
  try {
    const prompt = `${SHOTS[id]}, ${STYLE}`;
    const r = FLUX ? await client.predict("/infer", { prompt, seed: 1207, randomize_seed: false, width: 1536, height: 864, guidance_scale: 3.5, num_inference_steps: 28 })
                   : await client.predict("/generate", { prompt, resolution: "1280x720 ( 16:9 )", seed: 1207, steps: 8, shift: 3, random_seed: false, gallery_images: [] });
    const img = FLUX ? r.data[0] : r.data[0][0].image, url = img?.url || img;
    fs.writeFileSync(path.join(OUT, `${id}.webp`), Buffer.from(await (await fetch(url, { headers: { authorization: `Bearer ${token}` } })).arrayBuffer()));
    console.log("saved", id, ((Date.now() - t) / 1000).toFixed(0) + "s");
  } catch (e) { console.log("failed", id, String(e.message || e).slice(0, 160)); if (/quota|exceeded/i.test(String(e.message))) break; }
}
process.exit(0);
