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

const WATER = "IMPORTANT: The pool must be completely filled with clean sparkling crystal-blue water — this is mandatory. ";

const finishDetails = {
  kahlua: {
    label: "Kahlua",
    description: "SGM Kahlua spray deck — warm sandy coffee-brown textured concrete deck",
    editPrompt: WATER + "Edit this pool photo: (1) Fill the pool completely with clean sparkling crystal-blue water. (2) Resurface the pool deck with SGM Kahlua spray deck — smooth textured concrete in warm coffee-caramel sandy brown (#C4A882). Keep the house, trees, sky, fence, and all surroundings identical. Only the pool water and deck surface change.",
  },
  dessert: {
    label: "Dessert",
    description: "SGM Dessert spray deck — pale cream warm ivory textured concrete deck",
    editPrompt: WATER + "Edit this pool photo: (1) Fill the pool completely with clean sparkling crystal-blue water. (2) Resurface the pool deck with SGM Dessert spray deck — smooth textured concrete in pale cream warm ivory (#E8D5B0). Keep the house, trees, sky, fence, and all surroundings identical. Only the pool water and deck surface change.",
  },
  tile: {
    label: "Blue Gemstone 6×6",
    description: "National Pool Tile Blue Gemstone 6×6 — glossy deep ocean-blue ceramic tile",
    editPrompt: WATER + "Edit this pool photo: (1) Fill the pool completely with clean sparkling crystal-blue water. (2) Replace the pool interior walls and waterline with National Pool Tile Blue Gemstone 6x6 glossy ceramic tiles — deep sapphire ocean-blue in a clean grid pattern. Keep the pool deck, house, trees, sky identical. Only the pool water and interior tile change.",
  },
  plaster_white: {
    label: "White Plaster & Quartz",
    description: "White plaster & quartz — bright white smooth interior making water appear vivid turquoise-blue",
    editPrompt: WATER + "Edit this pool photo: (1) Fill the pool completely with vivid crystal turquoise-blue water (the white plaster makes water appear bright turquoise). (2) Resurface the pool interior with smooth bright white plaster and quartz — pure white on all interior walls and floor. Keep the pool deck, house, trees, sky identical. Only the pool water and interior plaster change.",
  },
  plaster_lightblue: {
    label: "Light Blue Plaster",
    description: "Light blue plaster — soft sky-blue interior giving the pool a stunning bright aqua water color",
    editPrompt: WATER + "Edit this pool photo: (1) Fill the pool completely with beautiful bright aqua-blue water. (2) Resurface the pool interior with smooth light sky-blue plaster — soft powder blue color on all interior walls and floor, giving the water a stunning aqua shimmer. Keep the pool deck, house, trees, sky identical. Only the pool water and interior plaster change.",
  },
  plaster_dark: {
    label: "Dark Plaster",
    description: "Dark charcoal/midnight plaster — deep dark interior giving the pool a dramatic deep blue almost black water appearance",
    editPrompt: WATER + "Edit this pool photo: (1) Fill the pool completely with deep dramatic dark-blue water — the dark plaster creates a stunning near-black navy appearance. (2) Resurface the pool interior with smooth dark charcoal plaster — near-black deep grey color on all interior walls and floor. Keep the pool deck, house, trees, sky identical. Only the pool water and interior plaster change.",
  },
  coping_lueders_buff: {
    label: "Lueders Buff Coping",
    description: "Lueders buff limestone pool coping — smooth flat-cut rectangular slabs of warm cream/beige Texas limestone sitting as the cap directly on top of the pool edge",
    editPrompt: WATER + "Edit this pool photo: (1) Fill the pool completely with clean sparkling crystal-blue water. (2) Replace ONLY the pool coping — the flat horizontal stone cap/slab that sits right on top of the pool wall edge — with Lueders buff limestone: smooth honed flat-cut rectangular slabs, warm cream and beige color (#D4C49A), clean sawn edges with a slight bullnose lip overhanging the pool, subtle natural limestone grain with soft tan variation, joints between slabs visible. This is exactly the style of flat limestone pool coping cap stone. Do NOT change the pool deck surface, pool interior, tile, house, trees, or sky. Only the coping cap stones and pool water change.",
  },
  coping_lueders_charcoal: {
    label: "Lueders Charcoal Coping",
    description: "Lueders charcoal limestone pool coping — smooth flat-cut rectangular slabs of dark grey Texas limestone sitting as the cap directly on top of the pool edge",
    editPrompt: WATER + "Edit this pool photo: (1) Fill the pool completely with clean sparkling crystal-blue water. (2) Replace ONLY the pool coping — the flat horizontal stone cap/slab that sits right on top of the pool wall edge — with Lueders charcoal limestone: smooth honed flat-cut rectangular slabs, dark charcoal grey color (#3D3D3D), clean sawn edges with a slight bullnose lip overhanging the pool, subtle natural limestone grain with dark tone variation, joints between slabs visible. This is exactly the style of flat limestone pool coping cap stone. Do NOT change the pool deck surface, pool interior, tile, house, trees, or sky. Only the coping cap stones and pool water change.",
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

    const normalizedBuffer = await sharp(imageFile.buffer)
      .rotate()
      .resize(2048, 2048, { fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: 90 })
      .toBuffer();

    const imageBase64 = normalizedBuffer.toString("base64");
    const mediaType = "image/jpeg";
    const imageDataUrl = `data:${mediaType};base64,${imageBase64}`;

    const analysisResponse = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1000,
      messages: [{
        role: "user",
        content: [
          { type: "image", source: { type: "base64", media_type: mediaType, data: imageBase64 } },
          { type: "text", text: `You are a professional pool remodeling consultant. Analyze this pool photo in 3 short sections:\n\n1. CURRENT CONDITION: State of the pool (cracking, staining, fading, algae, empty, etc.)\n2. RECOMMENDED WORK: What work is needed?\n3. EXPECTED TRANSFORMATION: How will applying ${finishInfo.description} improve this pool?\n\nKeep each section to 2-3 sentences. Be specific.` },
        ],
      }],
    });
    const analysisText = analysisResponse.content.map((c) => c.text || "").join("");

    const output = await replicate.run("black-forest-labs/flux-kontext-pro", {
      input: {
        prompt: finishInfo.editPrompt,
        input_image: imageDataUrl,
        output_format: "jpg",
        safety_tolerance: 5,
      },
    });

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
