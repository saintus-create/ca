import { NextRequest, NextResponse } from "next/server";
const SOURCE = "https://raw.githubusercontent.com/saintus-create/CALEGINFO/main/public/corpus/";
const ALLOWED = /^(manifest\.json|law\/[A-Z]+\.jsonl\.gz|legislation\/BILLS\.jsonl\.gz|rules\/ROC\.jsonl\.gz|forms\/FORMS\.jsonl\.gz|cases\/FAM_CASES\.json\.gz|directory\/DIRECTORY\.json\.gz|library\/wp-digest\.jsonl\.gz)$/;
export async function GET(request: NextRequest) {
 const file = request.nextUrl.searchParams.get("file") ?? "manifest.json";
 if (!ALLOWED.test(file) || file.includes("..")) return NextResponse.json({ error: "Unknown corpus asset." }, { status: 400 });
 try {
  const upstream = await fetch(SOURCE + file, { next: { revalidate: 3600 }, headers: { Accept: "application/octet-stream" } });
  if (!upstream.ok) return NextResponse.json({ error: "Corpus source unavailable." }, { status: upstream.status });
  const headers = new Headers(); headers.set("Content-Type", file.endsWith(".json") ? "application/json; charset=utf-8" : "application/gzip"); headers.set("Cache-Control", "public, s-maxage=3600, stale-while-revalidate=86400"); headers.set("X-Corpus-Source", "saintus-create/CALEGINFO");
  return new NextResponse(upstream.body, { status: 200, headers });
 } catch { return NextResponse.json({ error: "Unable to retrieve the corpus source." }, { status: 502 }); }
}
