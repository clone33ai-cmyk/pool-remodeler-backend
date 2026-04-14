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

const WATER = "The pool must be completely filled with clean sparkling crystal-blue water — this is mandatory. ";

// Retry Replicate calls on 429 with exponential backoff
async function replicateWithRetry(replicate, model, input, maxRetries = 5) {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await replicate.run(model, { input });
    } catch (err) {
      const is429 = err.message && (
        err.message.includes("429") ||
        err.message.includes("Too Many Requests") ||
        err.message.includes("throttled")
      );
      if (is429 && attempt < maxRetries) {
        const retryMatch = err.message.match(/retry_after["\s:]+(\d+)/);
        const waitMs = retryMatch
          ? (parseInt(retryMatch[1]) * 1000 + 1000)
          : (Math.pow(2, attempt + 1) * 4000);
        console.log(`Rate limited attempt ${attempt + 1}, waiting ${waitMs}ms...`);
        await new Promise(r => setTimeout(r, waitMs));
      } else {
        throw err;
      }
    }
  }
}

// 6 fixed combinations shown to every user
const PACKAGES = [
  {
    id: "pkg1",
    name: "Classic Cream",
    tagline: "Dessert deck · White plaster · Lueders buff coping",
    prompt: WATER + `Edit this pool photo to show a complete premium remodel:
1. Fill pool completely with vivid sparkling turquoise-blue water.
2. Resurface the pool deck with SGM Dessert spray deck — pale cream ivory textured concrete (#E8D5B0).
3. Resurface pool interior with smooth bright white plaster and quartz — pure white walls and floor making water appear vivid turquoise.
4. Replace pool coping (the flat cap stone on top of the pool wall edge) with Lueders buff limestone — smooth honed cream/beige rectangular slabs with bullnose lip (#D4C49A).
5. Keep the house, trees, sky, fences, furniture, and all surroundings pixel-perfect identical.`,
  },
  {
    id: "pkg2",
    name: "Desert Dusk",
    tagline: "Kahlua deck · Light blue plaster · Lueders buff coping",
    prompt: WATER + `Edit this pool photo to show a complete premium remodel:
1. Fill pool completely with bright aqua-blue water.
2. Resurface the pool deck with SGM Kahlua spray deck — warm coffee-caramel sandy brown textured concrete (#C4A882).
3. Resurface pool interior with smooth light sky-blue plaster — soft powder blue on all walls and floor giving the water a stunning aqua shimmer.
4. Replace pool coping (the flat cap stone on top of the pool wall edge) with Lueders buff limestone — smooth honed cream/beige rectangular slabs with bullnose lip (#D4C49A).
5. Keep the house, trees, sky, fences, furniture, and all surroundings pixel-perfect identical.`,
  },
  {
    id: "pkg3",
    name: "Midnight Modern",
    tagline: "Kahlua deck · Dark plaster · Lueders charcoal coping · Blue Gemstone tile",
    prompt: WATER + `Edit this pool photo to show a complete premium remodel:
1. Fill pool completely with deep dramatic dark navy-blue water.
2. Resurface the pool deck with SGM Kahlua spray deck — warm coffee-caramel sandy brown textured concrete (#C4A882).
3. Resurface pool interior with smooth dark charcoal plaster — near-black deep grey on all walls and floor creating dramatic dark water.
4. Replace pool coping (flat cap stone on pool wall edge) with Lueders charcoal limestone — smooth honed dark grey rectangular slabs (#3D3D3D) with bullnose lip.
5. Add National Pool Tile Blue Gemstone 6x6 glossy ceramic waterline tile band — deep sapphire blue, 6-inch strip along waterline only.
6. Keep the house, trees, sky, fences, furniture, and all surroundings pixel-perfect identical.`,
  },
  {
    id: "pkg4",
    name: "Azure Resort",
    tagline: "Dessert deck · Blue Gemstone tile · Lueders charcoal coping",
    prompt: WATER + `Edit this pool photo to show a complete premium remodel:
1. Fill pool completely with brilliant crystal-blue water.
2. Resurface the pool deck with SGM Dessert spray deck — pale cream ivory textured concrete (#E8D5B0).
3. Replace pool coping (flat cap stone on pool wall edge) with Lueders charcoal limestone — smooth honed dark grey rectangular slabs (#3D3D3D) with bullnose lip.
4. Add National Pool Tile Blue Gemstone 6x6 glossy ceramic waterline tile band — deep ocean-blue sapphire, clean grid, 6-inch strip at waterline only.
5. Keep pool interior plaster as-is. Keep the house, trees, sky, fences, furniture, and all surroundings pixel-perfect identical.`,
  },
  {
    id: "pkg5",
    name: "Stone & Sky",
    tagline: "Dessert deck · Light blue plaster · Lueders charcoal coping",
    prompt: WATER + `Edit this pool photo to show a complete premium remodel:
1. Fill pool completely with stunning bright aqua-blue water.
2. Resurface the pool deck with SGM Dessert spray deck — pale cream ivory textured concrete (#E8D5B0).
3. Resurface pool interior with smooth light sky-blue plaster — soft powder blue on all walls and floor.
4. Replace pool coping (flat cap stone on pool wall edge) with Lueders charcoal limestone — smooth honed dark grey rectangular slabs (#3D3D3D) with bullnose lip creating a bold contrast.
5. Keep the house, trees, sky, fences, furniture, and all surroundings pixel-perfect identical.`,
  },
  {
    id: "pkg6",
    name: "Warm Elegance",
    tagline: "Kahlua deck · White plaster · Lueders buff coping · Blue Gemstone tile",
    prompt: WATER + `Edit this pool photo to show a complete premium remodel:
1. Fill pool completely with vivid sparkling turquoise-blue water.
2. Resurface the pool deck with SGM Kahlua spray deck — warm coffee-caramel sandy brown textured concrete (#C4A882).
3. Resurface pool interior with smooth bright white plaster and quartz — pure white walls and floor.
4. Replace pool coping (flat cap stone on pool wall edge) with Lueders buff limestone — smooth honed cream/beige rectangular slabs (#D4C49A) with bullnose lip.
5. Add National Pool Tile Blue Gemstone 6x6 glossy ceramic waterline tile band — deep sapphire blue, 6-inch strip at waterline only.
6. Keep the house, trees, sky, fences, furniture, and all surroundings pixel-perfect identical.`,
  },
];

app.get("/health", (req, res) => res.json({ status: "ok", service: "AI Pool Remodeler API" }));

// Single package endpoint
app.post("/remodel", upload.single("image"), async (req, res) => {
  try {
    const Anthropic = require("@anthropic-ai/sdk");
    const Replicate = require("replicate");
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const replicate = new Replicate({ auth: process.env.REPLICATE_API_TOKEN });

    const { packageId, delayMs } = req.body;
    const imageFile = req.file;

    if (!imageFile) return res.status(400).json({ error: "No image provided" });
    const pkg = PACKAGES.find(p => p.id === packageId);
    if (!pkg) return res.status(400).json({ error: "Invalid package" });

    // Stagger delay to avoid rate limits
    if (delayMs && parseInt(delayMs) > 0) {
      await new Promise(r => setTimeout(r, parseInt(delayMs)));
    }

    const normalizedBuffer = await sharp(imageFile.buffer)
      .rotate()
      .resize(2048, 2048, { fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: 90 })
      .toBuffer();

    const imageBase64 = normalizedBuffer.toString("base64");
    const mediaType = "image/jpeg";
    const imageDataUrl = `data:${mediaType};base64,${imageBase64}`;

    // Claude Vision analysis
    const analysisResponse = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 600,
      messages: [{
        role: "user",
        content: [
          { type: "image", source: { type: "base64", media_type: mediaType, data: imageBase64 } },
          { type: "text", text: `You are a professional pool remodeling consultant. For the remodel package "${pkg.name}" (${pkg.tagline}), write a 2-3 sentence description of what this transformation will look like and why it will improve this specific pool. Be enthusiastic and specific to what you see in the photo.` },
        ],
      }],
    });
    const analysisText = analysisResponse.content.map((c) => c.text || "").join("");

    // Flux Kontext Pro image edit with retry
    const output = await replicateWithRetry(replicate, "black-forest-labs/flux-kontext-pro", {
      prompt: pkg.prompt,
      input_image: imageDataUrl,
      output_format: "jpg",
      safety_tolerance: 5,
    });

    const imgUrl = Array.isArray(output) ? output[0] : output;
    const imgFetch = await fetch(imgUrl);
    const imgBuffer = await imgFetch.arrayBuffer();
    const imgBase64 = Buffer.from(imgBuffer).toString("base64");

    res.json({
      success: true,
      packageId: pkg.id,
      packageName: pkg.name,
      tagline: pkg.tagline,
      analysisText,
      generatedImage: `data:image/jpeg;base64,${imgBase64}`,
    });
  } catch (err) {
    console.error("Remodel error:", err.message);
    res.status(500).json({ error: err.message || "Something went wrong" });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Pool Remodeler running on port ${PORT}`));
