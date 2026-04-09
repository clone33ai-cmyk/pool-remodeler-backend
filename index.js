const express = require("express");
const cors = require("cors");
const multer = require("multer");
const path = require("path");

const app = express();
const upload = multer({ limits: { fileSize: 10 * 1024 * 1024 } });

app.use(cors());
app.use(express.json());

// Serve frontend
app.use(express.static(path.join(__dirname, "public")));

const finishDetails = {
  kahlua: {
    label: "Kahlua",
    description: "SGM Kahlua spray deck — a textured concrete resurfacing system in warm, sandy coffee-brown tones",
    prompt: "Transform this pool deck and surround with SGM Kahlua spray deck finish: smooth-to-lightly textured concrete surface in warm coffee-caramel sandy brown color, clean crisp edges around the pool coping, uniform color with natural concrete texture variation. The pool water remains blue. Photorealistic pool remodel, bright daylight, professional photography.",
  },
  dessert: {
    label: "Dessert",
    description: "SGM Dessert spray deck — a textured concrete resurfacing system in light, pale cream and warm ivory tones",
    prompt: "Transform this pool deck and surround with SGM Dessert spray deck finish: smooth-to-lightly textured concrete surface in pale cream soft warm ivory color, clean crisp edges around the pool coping, uniform light color with natural concrete texture variation. The pool water remains blue. Photorealistic pool remodel, bright daylight, professional photography.",
  },
  tile: {
    label: "Blue Gemstone 6×6",
    description: "National Pool Tile GMS Blue Gemstone 6×6 — a glossy deep ocean-blue ceramic tile for pool interiors and waterlines",
    prompt: "Transform the waterline and interior of this pool with National Pool Tile Blue Gemstone 6x6 ceramic tiles: glossy deep ocean-blue tiles in a clean grid pattern along the waterline band and pool interior walls, rich sapphire-cobalt blue color, reflective glossy finish. The pool deck stays the same. Photorealistic pool remodel, bright daylight, professional photography.",
  },
};

app.get("/health", (req, res) => res.json({ status: "ok", service: "AI Pool Remodeler API" }));

app.post("/remodel", upload.single("image"), async (req, res) => {
  try {
    const Anthropic = require("@anthropic-ai/sdk");
    const OpenAI = require("openai");
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const { finish } = req.body;
    const imageFile = req.file;

    if (!imageFile) return res.status(400).json({ error: "No image provided" });
    if (!finish || !finishDetails[finish]) return res.status(400).json({ error: "Invalid finish selected" });

    const finishInfo = finishDetails[finish];
    const imageBase64 = imageFile.buffer.toString("base64");
    const mediaType = imageFile.mimetype || "image/jpeg";

    const analysisResponse = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1000,
      messages: [{
        role: "user",
        content: [
          { type: "image", source: { type: "base64", media_type: mediaType, data: imageBase64 } },
          { type: "text", text: `You are a professional pool remodeling consultant. Analyze this pool photo and provide a brief assessment in 3 short sections:\n\n1. CURRENT CONDITION: What is the state of the pool? (cracking, staining, fading, algae, outdated finish, etc.)\n2. RECOMMENDED WORK: What remodeling work is needed based on what you see?\n3. EXPECTED TRANSFORMATION: How will applying ${finishInfo.description} improve this pool specifically?\n\nKeep each section to 2-3 sentences. Be specific about what you see.` },
        ],
      }],
    });

    const analysisText = analysisResponse.content.map((c) => c.text || "").join("");

    const imageResponse = await openai.images.generate({
      model: "dall-e-3",
      prompt: `A professional pool remodeling transformation photo. ${finishInfo.prompt} Keep the same camera angle and pool shape as the original. High quality, photorealistic.`,
      n: 1,
      size: "1024x1024",
      quality: "standard",
    });

    const imgFetch = await fetch(imageResponse.data[0].url);
    const imgBuffer = await imgFetch.arrayBuffer();
    const imgBase64 = Buffer.from(imgBuffer).toString("base64");

    res.json({
      success: true,
      analysisText,
      generatedImage: `data:image/png;base64,${imgBase64}`,
      finishLabel: finishInfo.label,
    });
  } catch (err) {
    console.error("Remodel error:", err.message);
    res.status(500).json({ error: err.message || "Something went wrong" });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Pool Remodeler running on port ${PORT}`));
