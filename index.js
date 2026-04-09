const express = require("express");
const cors = require("cors");
const multer = require("multer");
const path = require("path");
const sharp = require("sharp");

const app = express();
// Increase payload limit for large files
app.use(cors());
app.use(express.json({ limit: "50mb" }));
app.use(express.static(path.join(__dirname, "public")));

// Accept up to 50MB uploads
const upload = multer({ limits: { fileSize: 50 * 1024 * 1024 } });

const WATER_INSTRUCTION = "IMPORTANT: The pool must be completely filled with clean, sparkling crystal-blue water — this is mandatory. ";

const finishDetails = {
  kahlua: {
    label: "Kahlua",
    description: "SGM Kahlua spray deck — warm sandy coffee-brown textured concrete deck",
    editPrompt: WATER_INSTRUCTION + "Edit this pool photo: (1) Fill the pool completely with clean sparkling crystal-blue water. (2) Resurface the pool deck and coping with SGM Kahlua spray deck — smooth textured concrete in warm coffee-caramel sandy brown (#C4A882). Keep the house, trees, sky, fence, and all surroundings pixel-perfect identical. Only the pool water and deck surface should change.",
    negativePrompt: "empty pool, dry pool, no water, different background, changed trees, changed house, blurry",
  },
  dessert: {
    label: "Dessert",
    description: "SGM Dessert spray deck — pale cream warm ivory textured concrete deck",
    editPrompt: WATER_INSTRUCTION + "Edit this pool photo: (1) Fill the pool completely with clean sparkling crystal-blue water. (2) Resurface the pool deck and coping with SGM Dessert spray deck — smooth textured concrete in pale cream warm ivory color (#E8D5B0). Keep the house, trees, sky, fence, and all surroundings pixel-perfect identical. Only the pool water and deck surface should change.",
    negativePrompt: "empty pool, dry pool, no water, different background, changed trees, changed house, blurry",
  },
  tile: {
    label: "Blue Gemstone 6×6",
    description: "National Pool Tile Blue Gemstone 6×6 — glossy deep ocean-blue ceramic tile on pool interior",
    editPrompt: WATER_INSTRUCTION + "Edit this pool photo: (1) Fill the pool completely with clean sparkling crystal-blue water. (2) Replace the pool interior walls and waterline band with National Pool Tile Blue Gemstone 6x6 glossy ceramic tiles — deep sapphire ocean-blue in a clean grid pattern, highly reflective glossy finish. Keep the pool deck, house, trees, sky, fence, and all surroundings pixel-perfect identical. Only the pool water and interior tile surface should change.",
    negativePrompt: "empty pool, dry pool, no water, different deck, changed trees, changed house, blurry",
  },
  plaster: {
    label: "White Plaster & Quartz",
    description: "White Plaster & Quartz finish — bright white smooth interior giving the pool a vivid turquoise-blue water color",
    editPrompt: WATER_INSTRUCTION + "Edit this pool photo: (1) Fill the pool completely with clean sparkling crystal-blue turquoise water — the white plaster below makes the water appear vivid bright turquoise-blue. (2) Resurface the pool interior with smooth bright white plaster and quartz finish — pure white smooth surface on all interior walls and floor. Keep the pool deck, house, trees, sky, fence, and all surroundings pixel-perfect identical. Only the pool water and interior plaster surface should change.",
    negativePrompt: "empty pool, dry pool, no water, yellow water, dirty water, different deck, changed trees, changed house, blurry",
  },
};

app.get("/health", (req, res) => res.json({ status: "ok", service: "AI Pool Remodeler API" }));

app.post("/remodel", upload.single("image"), async (req, res) => {
  try {
    const Anthropic = require("@anthropic-ai/sdk");
    const Replicate = require("replicate");

    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const replicate = new Replicate({ auth: process.env.REPLICATE_API_TOKEN });

    const { finish } = req.body;
    const imageFile = req.file;

    if (!imageFile) return res.status(400).json({ error: "No image provided" });
    if (!finish || !finishDetails[finish]) return res.status(400).json({ error: "Invalid finish selected" });

    const finishInfo = finishDetails[finish];

    // Normalize image: convert any format (PNG, WEBP, HEIC, etc.) to JPEG
    // and resize if larger than 2048px on longest side (Flux input limit)
    const normalizedBuffer = await sharp(imageFile.buffer)
      .rotate() // auto-rotate based on EXIF
      .resize(2048, 2048, { fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: 90 })
      .toBuffer();

    const imageBase64 = normalizedBuffer.toString("base64");
    const mediaType = "image/jpeg";
    const imageDataUrl = `data:${mediaType};base64,${imageBase64}`;

    // Step 1: Claude Vision analysis
    const analysisResponse = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1000,
      messages: [{
        role: "user",
        content: [
          { type: "image", source: { type: "base64", media_type: mediaType, data: imageBase64 } },
          { type: "text", text: `You are a professional pool remodeling consultant. Analyze this pool photo and provide a brief assessment in 3 short sections:\n\n1. CURRENT CONDITION: What is the state of the pool? (cracking, staining, fading, algae, outdated finish, empty, etc.)\n2. RECOMMENDED WORK: What remodeling work is needed based on what you see?\n3. EXPECTED TRANSFORMATION: How will applying ${finishInfo.description} improve this pool specifically?\n\nKeep each section to 2-3 sentences. Be specific about what you see.` },
        ],
      }],
    });
    const analysisText = analysisResponse.content.map((c) => c.text || "").join("");

    // Step 2: Flux Kontext Pro — instruction-based image editing
    const output = await replicate.run(
      "black-forest-labs/flux-kontext-pro",
      {
        input: {
          prompt: finishInfo.editPrompt,
          input_image: imageDataUrl,
          output_format: "jpg",
          safety_tolerance: 5,
        },
      }
    );

    const imgUrl = Array.isArray(output) ? output[0] : output;
    const imgFetch = await fetch(imgUrl);
    const imgBuffer = await imgFetch.arrayBuffer();
    const imgBase64 = Buffer.from(imgBuffer).toString("base64");

    res.json({
      success: true,
      analysisText,
      generatedImage: `data:image/jpeg;base64,${imgBase64}`,
      finishLabel: finishInfo.label,
    });
  } catch (err) {
    console.error("Remodel error:", err.message);
    res.status(500).json({ error: err.message || "Something went wrong" });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Pool Remodeler running on port ${PORT}`));
