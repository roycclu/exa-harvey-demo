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

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      throw new ApiError("Upload a contract, case summary, or supporting document first.", 400);
    }

    const documentText = await extractDocumentText(file);
    const angles = await extractSearchAngles(documentText);

    const [precedent, opposingCounsel, industryNews] = await Promise.all([
      searchExa({
        query: angles.precedent,
        numResults: CATEGORY_CONFIG.precedent.numResults,
        category: "precedent"
      }),
      searchExa({
        query: angles.opposingCounsel,
        numResults: CATEGORY_CONFIG.opposingCounsel.numResults,
        category: "opposingCounsel"
      }),
      searchExa({
        query: angles.industryNews,
        numResults: CATEGORY_CONFIG.industryNews.numResults,
        category: "industryNews"
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
