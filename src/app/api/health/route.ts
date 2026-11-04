import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    status: "ok",
    service: "shogun-stream",
    timestamp: new Date().toISOString(),
  });
}