import { NextResponse } from "next/server";
import { getData } from "@/lib/data";

export async function POST(request: Request) {
  const data = await getData();
  await data.signOut();
  return NextResponse.redirect(new URL("/login", request.url), { status: 303 });
}
