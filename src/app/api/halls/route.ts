import { NextResponse } from "next/server";
import { SAMPLE_HALLS } from "@/lib/sample-data";
import { fetchDiningHalls } from "@/lib/nutrislice";

export async function GET() {
  try {
    const halls = await fetchDiningHalls();
    return NextResponse.json({ source: "live" as const, halls });
  } catch (error) {
    console.error("halls fallback", error);
    return NextResponse.json({
      source: "sample" as const,
      halls: SAMPLE_HALLS,
      warning: "Live Nutrislice data unavailable; showing sample halls.",
    });
  }
}
