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
  // ── 6 visual concept packages ──
  {
    id: "pkg1", name: "Classic Cream",
    prompt: WATER + "Edit this pool: (1) Fill pool with vivid turquoise-blue water. (2) Resurface pool interior with smooth bright white plaster — pure white walls and floor. (3) Resurface deck with SGM Dessert spray deck — pale cream ivory textured concrete (#E8D5B0). (4) Replace pool coping with Lueders buff limestone — smooth cream/beige flat rectangular slabs with bullnose lip. Keep house, trees, sky identical."
  },
  {
    id: "pkg2", name: "Desert Dusk",
    prompt: WATER + "Edit this pool: (1) Fill pool with bright aqua-blue water. (2) Resurface pool interior with smooth light sky-blue plaster — soft powder blue on all walls and floor. (3) Resurface deck with SGM Kahlua spray deck — warm coffee-caramel sandy brown textured concrete (#C4A882). (4) Replace pool coping with Lueders buff limestone — smooth cream/beige flat rectangular slabs with bullnose lip. Keep house, trees, sky identical."
  },
  {
    id: "pkg3", name: "Midnight Modern",
    prompt: WATER + "Edit this pool: (1) Fill pool with deep dramatic dark navy-blue water. (2) Resurface pool interior with smooth dark charcoal plaster — near-black deep grey walls and floor. (3) Add National Pool Tile Blue Gemstone 6x6 glossy sapphire-blue waterline tile band — 6-inch strip at waterline only. (4) Resurface deck with SGM Kahlua spray deck — warm coffee-caramel sandy brown (#C4A882). (5) Replace coping with Lueders charcoal limestone — dark grey flat rectangular slabs with bullnose lip. Keep house, trees, sky identical."
  },
  {
    id: "pkg4", name: "Azure Resort",
    prompt: WATER + "Edit this pool: (1) Fill pool with brilliant crystal-blue water. (2) Add National Pool Tile Blue Gemstone 6x6 glossy sapphire-blue waterline tile band — 6-inch strip at waterline only. (3) Resurface deck with SGM Dessert spray deck — pale cream ivory textured concrete (#E8D5B0). (4) Replace coping with Lueders charcoal limestone — dark grey flat rectangular slabs with bullnose lip. Keep house, trees, sky identical."
  },
  {
    id: "pkg5", name: "Stone & Sky",
    prompt: WATER + "Edit this pool: (1) Fill pool with stunning bright aqua-blue water. (2) Resurface pool interior with smooth light sky-blue plaster — soft powder blue on all walls and floor. (3) Resurface deck with SGM Dessert spray deck — pale cream ivory textured concrete (#E8D5B0). (4) Replace coping with Lueders charcoal limestone — dark grey flat rectangular slabs with bullnose lip. Keep house, trees, sky identical."
  },
  {
    id: "pkg6", name: "Warm Elegance",
    prompt: WATER + "Edit this pool: (1) Fill pool with vivid sparkling turquoise-blue water. (2) Resurface pool interior with smooth bright white plaster — pure white walls and floor. (3) Add National Pool Tile Blue Gemstone 6x6 glossy sapphire-blue waterline tile band — 6-inch strip at waterline only. (4) Resurface deck with SGM Kahlua spray deck — warm coffee-caramel sandy brown (#C4A882). (5) Replace coping with Lueders buff limestone — smooth cream/beige flat rectangular slabs with bullnose lip. Keep house, trees, sky identical."
  },

  // ── 4 pricing tier packages ──
  {
    id: "price_bronze1", name: "New Tile — $5,500",
    prompt: WATER + "Edit this pool: (1) Fill pool with clean sparkling crystal-blue water. (2) Replace ONLY the 6-inch waterline tile band along pool walls with National Pool Tile Blue Gemstone 6x6 glossy ceramic tiles — deep sapphire blue, clean grid. Do NOT change deck, coping, interior plaster, house, trees, or sky."
  },
  {
    id: "price_bronze2", name: "Deck Resurfacing — $6,500",
    prompt: WATER + "Edit this pool: (1) Fill pool with clean sparkling crystal-blue water. (2) Resurface pool deck with SGM Kahlua spray deck — warm coffee-caramel sandy brown textured concrete (#C4A882). (3) Replace pool coping with Lueders buff limestone — smooth cream/beige flat rectangular slabs with bullnose lip. Do NOT change pool interior, tile, house, trees, or sky."
  },
  {
    id: "price_silver", name: "Tile & Plaster — $16,500",
    prompt: WATER + "Edit this pool: (1) Fill pool with vivid turquoise-blue water. (2) Resurface pool interior with smooth bright white plaster — pure white walls and floor. (3) Add 1x1 mosaic tile waterline band — small glossy white/blue mosaic tiles, 6-inch strip at waterline. (4) Resurface deck with SGM Dessert spray deck — pale cream ivory textured concrete (#E8D5B0). (5) Replace coping with Lueders buff limestone — smooth cream/beige flat slabs with bullnose lip. Keep house, trees, sky identical."
  },
  {
    id: "price_gold", name: "Tile & Upgraded Plaster — $19,500",
    prompt: WATER + "Edit this pool: (1) Fill pool with deep dramatic dark navy-blue water. (2) Resurface pool interior with smooth dark charcoal plaster — near-black deep grey walls and floor. (3) Add National Pool Tile Blue Gemstone 6x6 glossy sapphire-blue waterline tile band, 6-inch strip at waterline. (4) Resurface deck with SGM Kahlua spray deck — warm coffee-caramel sandy brown (#C4A882). (5) Replace coping with Lueders charcoal limestone — dark grey flat rectangular slabs with bullnose lip. Keep house, trees, sky identical."
  },
];

app.get("/health", (req, res) => res.json({ status: "ok" }));

app.post("/remodel", upload.single("image"), async (req, res) => {
  try {
    const Anthropic = require("@anthropic-ai/sdk");
    const Replicate = require("replicate");
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const replicate = new Replicate({ auth: process.env.REPLICATE_API_TOKEN });

    const { packageId, delayMs, variation } = req.body;
    const imageFile = req.file;
    if (!imageFile) return res.status(400).json({ error: "No image" });
    const pkg = PACKAGES.find(p => p.id === packageId);
    if (!pkg) return res.status(400).json({ error: "Invalid package" });

    if (delayMs && parseInt(delayMs) > 0) await new Promise(r => setTimeout(r, parseInt(delayMs)));

    const buf = await sharp(imageFile.buffer).rotate().resize(2048, 2048, { fit: "inside", withoutEnlargement: true }).jpeg({ quality: 90 }).toBuffer();
    const imageBase64 = buf.toString("base64");
    const mediaType = "image/jpeg";
    const imageDataUrl = `data:${mediaType};base64,${imageBase64}`;

    const ar = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514", max_tokens: 400,
      messages: [{ role: "user", content: [
        { type: "image", source: { type: "base64", media_type: mediaType, data: imageBase64 } },
        { type: "text", text: `You are a pool remodeling sales consultant in Plano, TX. For the "${pkg.name}" package, write 2 enthusiastic sentences describing what this transformation will look like for this specific pool. Mention it sells houses fast in Plano, TX.` }
      ]}]
    });
    const analysisText = ar.content.map(c => c.text || "").join("");

    // Add subtle variation to prompt so regenerations look different
    const variationHints = [
      "Bright midday sunlight, crisp shadows.",
      "Soft golden afternoon light.",
      "Clear blue sky, vibrant colors.",
      "Overcast soft light, rich saturated colors.",
      "Morning light, warm tones.",
      "Bright sunshine, high contrast.",
    ];
    const variationSeed = parseInt(variation || Date.now()) % variationHints.length;
    const finalPrompt = pkg.prompt + " " + variationHints[variationSeed];

    const output = await replicateWithRetry(replicate, "black-forest-labs/flux-kontext-pro", {
      prompt: finalPrompt, input_image: imageDataUrl, output_format: "jpg", safety_tolerance: 5
    });

    const imgUrl = Array.isArray(output) ? output[0] : output;
    const imgBuf = await (await fetch(imgUrl)).arrayBuffer();

    res.json({
      success: true, packageId: pkg.id, packageName: pkg.name, analysisText,
      generatedImage: `data:image/jpeg;base64,${Buffer.from(imgBuf).toString("base64")}`
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log("Pool Remodeler on port", PORT));
