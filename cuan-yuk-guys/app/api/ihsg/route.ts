import { NextResponse } from "next/server";
import { fetchIhsgTick } from "@/lib/market/ihsg";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  const tick = await fetchIhsgTick();
  if (!tick) {
    return NextResponse.json({ error: "IHSG unavailable" }, { status: 502, headers: { "Cache-Control": "no-store" } });
  }
  return NextResponse.json(tick, {
    headers: { "Cache-Control": "no-store, max-age=0" },
  });
}
