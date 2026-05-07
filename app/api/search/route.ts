import { NextResponse } from "next/server";

import { ApiError, getErrorMessage } from "@/lib/errors";
import { buildExaSearchRequest, searchExa } from "@/lib/exa";
import { buildGoogleSearchRequest, searchGoogle } from "@/lib/google";
import type { ManualSearchResponse } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      query?: string;
      numResults?: number;
      includeDomains?: string[];
    };
    const query = body.query?.trim();
    const numResults = Math.max(5, Math.min(body.numResults ?? 6, 8));
    const includeDomains = (body.includeDomains ?? []).filter(Boolean);

    if (!query) {
      throw new ApiError("Enter a search query before running manual search.", 400);
    }

    const [exaResults, googleResults] = await Promise.all([
      searchExa({
        query,
        numResults,
        category: "precedent",
        includeDomains
      }),
      searchGoogle({
        query,
        numResults,
        category: "precedent",
        includeDomains
      })
    ]);

    const payload: ManualSearchResponse = {
      mode: "manual",
      query,
      results: {
        exa: exaResults,
        google: googleResults
      },
      requests: {
        exa: buildExaSearchRequest({
          query,
          numResults,
          includeDomains
        }),
        google: buildGoogleSearchRequest({
          query,
          numResults,
          includeDomains
        })
      }
    };

    return NextResponse.json(payload);
  } catch (error) {
    const status = error instanceof ApiError ? error.status : 500;
    return NextResponse.json({ error: getErrorMessage(error) }, { status });
  }
}
