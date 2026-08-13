"use server";

import { analyzeEmiten, type AnalyzeResult } from "@/lib/analyst/analyze";

export async function analyzeEmitenAction(query: string): Promise<AnalyzeResult> {
  const q = String(query ?? "").slice(0, 80);
  return analyzeEmiten(q);
}
