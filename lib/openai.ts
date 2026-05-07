import { ApiError } from "@/lib/errors";
import type { SearchAngles } from "@/lib/types";

const OPENAI_RESPONSES_URL = "https://api.openai.com/v1/responses";

function getOpenAIApiKey() {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    throw new ApiError("Missing OPENAI_API_KEY environment variable.", 500);
  }

  return apiKey;
}

function parseAngles(rawText: string): SearchAngles {
  const cleaned = rawText.replace(/```json|```/g, "").trim();
  const parsed = JSON.parse(cleaned) as Partial<SearchAngles>;

  if (!parsed.precedent || !parsed.opposingCounsel || !parsed.industryNews) {
    throw new ApiError("OpenAI response is missing one or more search angles.", 502);
  }

  return {
    precedent: parsed.precedent.trim(),
    opposingCounsel: parsed.opposingCounsel.trim(),
    industryNews: parsed.industryNews.trim()
  };
}

function extractOutputText(payload: unknown) {
  if (!payload || typeof payload !== "object") {
    throw new ApiError("OpenAI returned an invalid response payload.", 502);
  }

  const outputText = (payload as { output_text?: string }).output_text;

  if (!outputText || typeof outputText !== "string") {
    throw new ApiError("OpenAI did not return usable text output.", 502);
  }

  return outputText;
}

export async function extractSearchAngles(documentText: string): Promise<SearchAngles> {
  const instructions = [
    "You are helping a legal research analyst turn an uploaded document into search strategies.",
    "Return valid JSON only with three string fields:",
    '"precedent": search angle for relevant precedents, cases, statutes, or legal analysis.',
    '"opposingCounsel": search angle for opposing counsel history, litigation posture, firms, and prior matters.',
    '"industryNews": search angle for industry, market, and company news relevant to the dispute or contract.',
    "Each value must be a concise natural language neural search query.",
    "Do not include markdown, commentary, or extra keys."
  ].join("\n");

  const response = await fetch(OPENAI_RESPONSES_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${getOpenAIApiKey()}`
    },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL || "gpt-4o-mini",
      instructions,
      input: `Document excerpt:\n${documentText.slice(0, 12000)}`,
      temperature: 0.1,
      max_output_tokens: 300,
      text: {
        format: {
          type: "json_object"
        }
      }
    }),
    cache: "no-store"
  });

  if (!response.ok) {
    const details = await response.text();
    throw new ApiError(
      `OpenAI extraction failed (${response.status}). ${details || "No details returned."}`,
      response.status
    );
  }

  const payload = await response.json();
  return parseAngles(extractOutputText(payload));
}
