import { NextResponse } from "next/server";

import { ApiError, getErrorMessage } from "@/lib/errors";
import { searchExa } from "@/lib/exa";
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

    const results = await searchExa({
      query,
      numResults,
      category: "precedent",
      includeDomains
    });

    const payload: ManualSearchResponse = {
      mode: "manual",
      query,
      results
    };

    return NextResponse.json(payload);
  } catch (error) {
    const status = error instanceof ApiError ? error.status : 500;
    return NextResponse.json({ error: getErrorMessage(error) }, { status });
  }
}
