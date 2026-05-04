const express = require("express");
const cors = require("cors");
const multer = require("multer");
const path = require("path");
const sharp = require("sharp");

const app = express();
app.use(cors());
app.use(express.json({ limit: "50mb" }));
app.use(express.static(path.join(__dirname, "public")));
const upload = multer({ limits: { fileSize: 50 * 1024 * 1024 } });

const WATER = "The pool must be completely filled with clean sparkling crystal-blue water. ";

async function replicateWithRetry(replicate, model, input, maxRetries = 5) {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try { return await replicate.run(model, { input }); }
    catch (err) {
      const is429 = err.message && (err.message.includes("429") || err.message.includes("throttled") || err.message.includes("Too Many"));
      if (is429 && attempt < maxRetries) {
        const m = err.message.match(/retry_after["\s:]+(\d+)/);
        const wait = m ? parseInt(m[1])*1000+1000 : Math.pow(2,attempt+1)*4000;
        console.log("Rate limited, waiting", wait, "ms");
        await new Promise(r => setTimeout(r, wait));
      } else throw err;
    }
  }
}

const PACKAGES = [
  {
    id:"pkg_tile", tier:"bronze", tierLabel:"Bronze", name:"New Tile", price:"$5,500",
    tagline:"Blue Gemstone 6×6 waterline tile",
    prompt: WATER + "Edit this pool: (1) Fill pool with crystal-blue water. (2) Replace ONLY the narrow 6-inch waterline tile band along pool walls at waterline with National Pool Tile Blue Gemstone 6x6 glossy ceramic tiles — deep sapphire blue, clean grid. Do NOT change deck, coping, interior plaster, house, trees, sky."
  },
  {
    id:"pkg_deck", tier:"bronze", tierLabel:"Bronze", name:"Deck Resurfacing", price:"$6,500",
    tagline:"Kahlua spray deck · Lueders buff limestone coping",
    prompt: WATER + "Edit this pool: (1) Fill pool with crystal-blue water. (2) Resurface pool deck with SGM Kahlua spray deck — warm coffee-caramel sandy brown textured concrete (#C4A882). (3) Replace pool coping (flat cap stone on top of pool wall edge) with Lueders buff limestone — smooth cream/beige rectangular slabs with bullnose lip. Do NOT change pool interior, tile, house, trees, sky."
  },
  {
    id:"pkg_silver", tier:"silver", tierLabel:"Silver", name:"Tile & Plaster", price:"$16,500",
    tagline:"White plaster · 1×1 mosaic tile · Lueders buff coping · Dessert deck",
    prompt: WATER + "Edit this pool: (1) Fill pool with vivid turquoise-blue water. (2) Resurface pool interior with smooth bright white plaster — pure white walls and floor making water appear vivid turquoise. (3) Add 1x1 mosaic tile waterline band — small glossy white/blue mosaic tiles, 6-inch strip at waterline. (4) Resurface deck with SGM Dessert spray deck — pale cream ivory textured concrete. (5) Replace coping with Lueders buff limestone slabs with bullnose lip. Keep house, trees, sky identical."
  },
  {
    id:"pkg_gold", tier:"gold", tierLabel:"Gold", name:"Tile & Upgraded Plaster", price:"$19,500",
    tagline:"Dark premium plaster · Blue Gemstone 6×6 tile · Lueders charcoal coping · Kahlua deck",
    prompt: WATER + "Edit this pool: (1) Fill pool with deep dramatic dark navy-blue water. (2) Resurface pool interior with smooth dark charcoal plaster — near-black deep grey walls and floor. (3) Add National Pool Tile Blue Gemstone 6x6 glossy sapphire-blue waterline tile band, 6-inch strip. (4) Resurface deck with SGM Kahlua spray deck — warm coffee-caramel sandy brown. (5) Replace coping with Lueders charcoal limestone — dark grey rectangular slabs with bullnose lip. Keep house, trees, sky identical."
  }
];

app.get("/health", (req,res) => res.json({status:"ok"}));

app.post("/remodel", upload.single("image"), async (req,res) => {
  try {
    const Anthropic = require("@anthropic-ai/sdk");
    const Replicate = require("replicate");
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const replicate = new Replicate({ auth: process.env.REPLICATE_API_TOKEN });

    const { packageId, delayMs } = req.body;
    const imageFile = req.file;
    if (!imageFile) return res.status(400).json({ error:"No image" });
    const pkg = PACKAGES.find(p => p.id === packageId);
    if (!pkg) return res.status(400).json({ error:"Invalid package" });

    if (delayMs && parseInt(delayMs) > 0) await new Promise(r => setTimeout(r, parseInt(delayMs)));

    const buf = await sharp(imageFile.buffer).rotate().resize(2048,2048,{fit:"inside",withoutEnlargement:true}).jpeg({quality:90}).toBuffer();
    const imageBase64 = buf.toString("base64");
    const mediaType = "image/jpeg";
    const imageDataUrl = `data:${mediaType};base64,${imageBase64}`;

    const ar = await anthropic.messages.create({
      model:"claude-sonnet-4-20250514", max_tokens:500,
      messages:[{ role:"user", content:[
        {type:"image", source:{type:"base64", media_type:mediaType, data:imageBase64}},
        {type:"text", text:`You are a professional pool remodeling sales consultant in Plano, TX. For the "${pkg.name}" package (${pkg.tagline}), write 2 enthusiastic sentences about what this transformation will look like for this specific pool. Mention that this pool design sells houses fast in Plano, TX.`}
      ]}]
    });
    const analysisText = ar.content.map(c=>c.text||"").join("");

    const output = await replicateWithRetry(replicate, "black-forest-labs/flux-kontext-pro", {
      prompt: pkg.prompt, input_image: imageDataUrl, output_format:"jpg", safety_tolerance:5
    });

    const imgUrl = Array.isArray(output) ? output[0] : output;
    const imgBuf = await (await fetch(imgUrl)).arrayBuffer();

    res.json({
      success:true, packageId:pkg.id, tier:pkg.tier, tierLabel:pkg.tierLabel,
      packageName:pkg.name, price:pkg.price, tagline:pkg.tagline, analysisText,
      generatedImage:`data:image/jpeg;base64,${Buffer.from(imgBuf).toString("base64")}`
    });
  } catch(err) {
    console.error(err.message);
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log("Pool Remodeler on port", PORT));
