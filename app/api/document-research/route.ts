import { NextResponse } from "next/server";

import { extractDocumentText } from "@/lib/document";
import { ApiError, getErrorMessage } from "@/lib/errors";
import { buildExaSearchRequest, searchExa } from "@/lib/exa";
import { buildGoogleSearchRequest, searchGoogle } from "@/lib/google";
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

    const [
      exaPrecedent,
      exaOpposingCounsel,
      exaIndustryNews,
      googlePrecedent,
      googleOpposingCounsel,
      googleIndustryNews
    ] = await Promise.all([
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
      }),
      searchGoogle({
        query: angles.precedent,
        numResults: CATEGORY_CONFIG.precedent.numResults,
        category: "precedent",
        includeDomains
      }),
      searchGoogle({
        query: angles.opposingCounsel,
        numResults: CATEGORY_CONFIG.opposingCounsel.numResults,
        category: "opposingCounsel",
        includeDomains
      }),
      searchGoogle({
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
        precedent: {
          exa: exaPrecedent,
          google: googlePrecedent
        },
        opposingCounsel: {
          exa: exaOpposingCounsel,
          google: googleOpposingCounsel
        },
        industryNews: {
          exa: exaIndustryNews,
          google: googleIndustryNews
        }
      },
      requests: {
        exa: {
          precedent: buildExaSearchRequest({
            query: angles.precedent,
            numResults: CATEGORY_CONFIG.precedent.numResults,
            includeDomains
          }),
          opposingCounsel: buildExaSearchRequest({
            query: angles.opposingCounsel,
            numResults: CATEGORY_CONFIG.opposingCounsel.numResults,
            includeDomains
          }),
          industryNews: buildExaSearchRequest({
            query: angles.industryNews,
            numResults: CATEGORY_CONFIG.industryNews.numResults,
            includeDomains
          })
        },
        google: {
          precedent: buildGoogleSearchRequest({
            query: angles.precedent,
            numResults: CATEGORY_CONFIG.precedent.numResults,
            includeDomains
          }),
          opposingCounsel: buildGoogleSearchRequest({
            query: angles.opposingCounsel,
            numResults: CATEGORY_CONFIG.opposingCounsel.numResults,
            includeDomains
          }),
          industryNews: buildGoogleSearchRequest({
            query: angles.industryNews,
            numResults: CATEGORY_CONFIG.industryNews.numResults,
            includeDomains
          })
        }
      }
    };

    return NextResponse.json(payload);
  } catch (error) {
    const status = error instanceof ApiError ? error.status : 500;
    return NextResponse.json({ error: getErrorMessage(error) }, { status });
  }
}
