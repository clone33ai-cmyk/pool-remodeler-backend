const express = require("express");
const cors = require("cors");
const multer = require("multer");
const path = require("path");

const app = express();
const upload = multer({ limits: { fileSize: 10 * 1024 * 1024 } });

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

const finishDetails = {
  kahlua: {
    label: "Kahlua",
    description: "SGM Kahlua spray deck — warm sandy coffee-brown textured concrete",
    editPrompt: "Replace the pool deck and coping surround with SGM Kahlua spray deck finish: smooth textured concrete in warm coffee-caramel sandy brown color (#C4A882). Keep everything else exactly the same — the pool water, the house, trees, sky, furniture, and all surroundings must remain completely unchanged. Only change the deck/surround surface material and color.",
    negativePrompt: "changed pool water, different background, different trees, different house, changed sky, blurry, distorted",
  },
  dessert: {
    label: "Dessert",
    description: "SGM Dessert spray deck — pale cream warm ivory textured concrete",
    editPrompt: "Replace the pool deck and coping surround with SGM Dessert spray deck finish: smooth textured concrete in pale cream warm ivory color (#E8D5B0). Keep everything else exactly the same — the pool water, the house, trees, sky, furniture, and all surroundings must remain completely unchanged. Only change the deck/surround surface material and color.",
    negativePrompt: "changed pool water, different background, different trees, different house, changed sky, blurry, distorted",
  },
  tile: {
    label: "Blue Gemstone 6×6",
    description: "National Pool Tile Blue Gemstone 6×6 — glossy deep ocean-blue ceramic tile",
    editPrompt: "Replace the pool interior walls and waterline with National Pool Tile Blue Gemstone 6x6 glossy ceramic tiles: deep ocean-blue sapphire color in a clean grid pattern, reflective glossy finish. Keep everything else exactly the same — the pool deck, house, trees, sky, furniture, and all surroundings must remain completely unchanged. Only change the pool interior tile surface.",
    negativePrompt: "changed deck, different background, different trees, different house, changed sky, blurry, distorted",
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
    const imageBase64 = imageFile.buffer.toString("base64");
    const mediaType = imageFile.mimetype || "image/jpeg";
    const imageDataUrl = `data:${mediaType};base64,${imageBase64}`;

    // Step 1: Claude Vision analysis
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

    // Step 2: Flux Kontext Pro — instruction-based image editing
    // This edits the ACTUAL photo rather than generating a new one
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

    // output is a URL — fetch and convert to base64
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
