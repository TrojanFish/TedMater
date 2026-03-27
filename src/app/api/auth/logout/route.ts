import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export const dynamic = "force-dynamic";

export async function POST() {
  const cookieStore = await cookies();
  const res = NextResponse.json({ success: true });
  res.cookies.set("ted_session", "", { maxAge: 0, path: "/" });
  return res;
}
