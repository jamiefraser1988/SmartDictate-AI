export interface TranscribeResult {
  transcript: string;
  summary: string;
  actionItems: string[];
}

export async function transcribeAudio(
  audioBase64: string,
  mimeType: string,
  duration: number
): Promise<TranscribeResult> {
  const domain = process.env.EXPO_PUBLIC_DOMAIN;
  const baseUrl = domain ? `https://${domain}` : "";

  const response = await fetch(`${baseUrl}/api/transcribe`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ audioBase64, mimeType, duration }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: "Unknown error" }));
    throw new Error((err as { error: string }).error ?? "Transcription failed");
  }

  return response.json() as Promise<TranscribeResult>;
}
