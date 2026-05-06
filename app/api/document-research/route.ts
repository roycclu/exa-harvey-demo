import { NextResponse } from "next/server";

import { extractDocumentText } from "@/lib/document";
import { ApiError, getErrorMessage } from "@/lib/errors";
import { searchExa } from "@/lib/exa";
import { extractSearchAngles } from "@/lib/openai";
import type { DocumentSearchResponse, ResearchCategory } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CATEGORY_CONFIG: Record<ResearchCategory, { numResults: number }> = {
  precedent: { numResults: 6 },
  opposingCounsel: { numResults: 5 },
  industryNews: { numResults: 5 }
};

function parseIncludeDomains(value: FormDataEntryValue | null) {
  if (typeof value !== "string" || !value.trim()) {
    return [];
  }

  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? parsed.filter((entry): entry is string => typeof entry === "string") : [];
  } catch {
    throw new ApiError("Invalid domain configuration submitted with the upload.", 400);
  }
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");
    const includeDomains = parseIncludeDomains(formData.get("includeDomains"));

    if (!(file instanceof File)) {
      throw new ApiError("Upload a contract, case summary, or supporting document first.", 400);
    }

    const documentText = await extractDocumentText(file);
    const angles = await extractSearchAngles(documentText);

    const [precedent, opposingCounsel, industryNews] = await Promise.all([
      searchExa({
        query: angles.precedent,
        numResults: CATEGORY_CONFIG.precedent.numResults,
        category: "precedent",
        includeDomains
      }),
      searchExa({
        query: angles.opposingCounsel,
        numResults: CATEGORY_CONFIG.opposingCounsel.numResults,
        category: "opposingCounsel",
        includeDomains
      }),
      searchExa({
        query: angles.industryNews,
        numResults: CATEGORY_CONFIG.industryNews.numResults,
        category: "industryNews",
        includeDomains
      })
    ]);

    const payload: DocumentSearchResponse = {
      mode: "document",
      filename: file.name,
      extractedTextPreview: documentText.slice(0, 600),
      angles,
      results: {
        precedent,
        opposingCounsel,
        industryNews
      }
    };

    return NextResponse.json(payload);
  } catch (error) {
    const status = error instanceof ApiError ? error.status : 500;
    return NextResponse.json({ error: getErrorMessage(error) }, { status });
  }
}
