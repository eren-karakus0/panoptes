import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json(
    { error: "Not Implemented", message: "Available in v0.3.0" },
    { status: 501 },
  );
}
