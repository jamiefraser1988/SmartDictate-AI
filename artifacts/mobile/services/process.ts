export type OutputFormat = "transcript" | "minutes" | "tasks" | "email";
export type Tone = "formal" | "informal";

export interface ProcessResult {
  result: string;
  format: OutputFormat;
  tone: Tone;
}

export async function processText(
  text: string,
  format: OutputFormat,
  tone: Tone = "formal"
): Promise<ProcessResult> {
  const domain = process.env.EXPO_PUBLIC_DOMAIN;
  const baseUrl = domain ? `https://${domain}` : "";

  const response = await fetch(`${baseUrl}/api/process`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, format, tone }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: "Unknown error" }));
    throw new Error((err as { error: string }).error ?? "Processing failed");
  }

  return response.json() as Promise<ProcessResult>;
}
