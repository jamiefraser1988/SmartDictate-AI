import { Router } from "express";
import { z } from "zod";
import { ai } from "@workspace/integrations-gemini-ai";

const transcribeRequestSchema = z.object({
  audioBase64: z.string().min(1, "audioBase64 is required"),
  mimeType: z.enum(["audio/m4a", "audio/mp4", "audio/mpeg", "audio/wav", "audio/ogg", "audio/webm"]),
  duration: z.number().int().nonnegative().optional(),
});

const transcribeResponseSchema = z.object({
  transcript: z.string(),
  summary: z.string(),
  actionItems: z.array(z.string()),
});

const router = Router();

router.post("/", async (req, res) => {
  const parsed = transcribeRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.errors[0]?.message ?? "Invalid request" });
    return;
  }

  const { audioBase64, mimeType } = parsed.data;

  const audioBytes = Buffer.byteLength(audioBase64, "base64");
  if (audioBytes > 15 * 1024 * 1024) {
    res.status(413).json({ error: "Audio file too large. Please keep recordings under 15 MB." });
    return;
  }

  try {
    const prompt = `You are an expert transcription and note-taking assistant.

I'm providing you with an audio recording. Please:
1. Transcribe the audio accurately and completely
2. Generate a concise summary (2-4 sentences) capturing the key points
3. Extract any action items, tasks, or follow-ups mentioned (as a JSON array of strings)

Respond ONLY with a valid JSON object in this exact format:
{
  "transcript": "full transcription here",
  "summary": "concise summary here",
  "actionItems": ["action item 1", "action item 2"]
}

If there are no action items, return an empty array. Do not include any text outside the JSON object.`;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [
        {
          role: "user",
          parts: [
            { inlineData: { mimeType, data: audioBase64 } },
            { text: prompt },
          ],
        },
      ],
      config: {
        maxOutputTokens: 8192,
        responseMimeType: "application/json",
      },
    });

    const rawText = response.text ?? "";

    let aiResult: z.infer<typeof transcribeResponseSchema>;

    const tryParse = (text: string) => {
      try {
        return transcribeResponseSchema.safeParse(JSON.parse(text));
      } catch {
        return { success: false as const };
      }
    };

    const primaryParsed = tryParse(rawText);
    if (primaryParsed.success) {
      aiResult = primaryParsed.data;
    } else {
      const jsonMatch = rawText.match(/\{[\s\S]*\}/);
      const fallbackParsed = jsonMatch ? tryParse(jsonMatch[0]) : { success: false as const };
      aiResult = fallbackParsed.success
        ? fallbackParsed.data
        : { transcript: rawText, summary: "Unable to generate summary.", actionItems: [] };
    }

    res.json(aiResult);
  } catch (err) {
    req.log.error({ err }, "Transcription failed");
    res.status(500).json({ error: "Transcription failed. Please try again." });
  }
});

export default router;
