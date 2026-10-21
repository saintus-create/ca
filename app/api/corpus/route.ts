import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { NextRequest, NextResponse } from "next/server";
const SOURCE = "https://raw.githubusercontent.com/saintus-create/CALEGINFO/main/public/corpus/";
const ALLOWED = /^(manifest\.json|law\/[A-Z]+\.jsonl\.gz|legislation\/BILLS\.jsonl\.gz|rules\/ROC\.jsonl\.gz|forms\/FORMS\.jsonl\.gz|cases\/FAM_CASES\.jsonl\.gz|directory\/DIRECTORY\.jsonl\.gz|library\/wp-digest\.jsonl\.gz)$/;
export async function GET(request: NextRequest) {
 const file = request.nextUrl.searchParams.get("file") ?? "manifest.json";
 if (!ALLOWED.test(file) || file.includes("..")) return NextResponse.json({ error: "Unknown corpus asset." }, { status: 400 });
 const headers = new Headers(); headers.set("Content-Type", file.endsWith(".json") ? "application/json; charset=utf-8" : "application/gzip"); headers.set("Cache-Control", "public, s-maxage=3600, stale-while-revalidate=86400"); headers.set("X-Corpus-Source", "saintus-create/ca cleaned corpus (from CALEGINFO)");
 try {
  if (file === "manifest.json") { const manifest = await readFile(join(process.cwd(), "public", "corpus", file), "utf8"); return new NextResponse(manifest, { status: 200, headers }); }
  const encoded = await readFile(join(process.cwd(), "public", "corpus", file + ".b64"), "utf8");
  return new NextResponse(Buffer.from(encoded.trim(), "base64"), { status: 200, headers });
 } catch { /* No single local file: try the split parts below before using the source corpus. */ }
 try {
  const dir = join(process.cwd(), "public", "corpus", file.slice(0, file.lastIndexOf("/")));
  const base = file.slice(file.lastIndexOf("/") + 1);
  const parts = (await readdir(dir)).filter((name) => name.startsWith(base + ".b64.part")).sort();
  if (!parts.length) throw new Error("No local corpus parts.");
  const chunks: string[] = [];
  for (const part of parts) chunks.push(await readFile(join(dir, part), "utf8"));
  return new NextResponse(Buffer.from(chunks.join("").trim(), "base64"), { status: 200, headers });
 } catch { /* Not yet transposed locally: use the source corpus until this asset is copied. */ }
 try {
  const upstream = await fetch(SOURCE + file, { next: { revalidate: 3600 }, headers: { Accept: "application/octet-stream" } });
  if (!upstream.ok) return NextResponse.json({ error: "Corpus source unavailable." }, { status: upstream.status });
  return new NextResponse(upstream.body, { status: 200, headers });
 } catch { return NextResponse.json({ error: "Unable to retrieve the corpus source." }, { status: 502 }); }
}
