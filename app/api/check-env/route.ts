import { NextResponse } from "next/server";
export async function GET() { return NextResponse.json({ error: "The research-agent configuration endpoint has been retired." }, { status: 410 }); }
