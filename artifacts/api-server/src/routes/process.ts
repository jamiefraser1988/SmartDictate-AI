import { Router } from "express";
import { z } from "zod";
import { ai } from "@workspace/integrations-gemini-ai";

const processRequestSchema = z.object({
  text: z.string().min(1, "text is required").max(25000),
  format: z.enum(["transcript", "minutes", "tasks", "email"]),
  tone: z.enum(["formal", "informal"]).optional().default("formal"),
});

const toneInstructions: Record<string, string> = {
  formal:
    "Use a professional, polished tone. Keep language precise and business-appropriate.",
  informal:
    "Use a friendly, conversational tone. Keep language natural and approachable.",
};

function buildPrompt(format: string, tone: string): string {
  const toneNote = toneInstructions[tone] || toneInstructions.formal;

  const base: Record<string, string> = {
    transcript: `Clean up the following transcript. Fix grammar, remove filler words, and improve flow while keeping the original meaning. ${toneNote}\n\n`,
    minutes: `Transform the following notes into structured meeting minutes. Include attendees (if mentioned), key discussion points, decisions, and action items. Use markdown formatting. ${toneNote}\n\n`,
    tasks: `Extract a clear, actionable task list from the following text. Use markdown checkboxes (- [ ]) for each task. Group related tasks if possible. ${toneNote}\n\n`,
    email: `Rewrite the following rough notes into a clear email. Include a subject line suggestion at the top. ${toneNote}\n\n`,
  };

  return base[format] || base.transcript;
}

const router = Router();

router.post("/", async (req, res) => {
  const parsed = processRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.errors[0]?.message ?? "Invalid request" });
    return;
  }

  const { text, format, tone } = parsed.data;

  try {
    const prompt = buildPrompt(format, tone);

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt + text,
      config: {
        maxOutputTokens: 8192,
      },
    });

    const result = response.text || "No response generated.";

    res.json({ result, format, tone });
  } catch (err) {
    req.log.error({ err }, "Processing failed");
    res.status(500).json({ error: "Failed to process your text. Please try again." });
  }
});

export default router;
