import { NextRequest, NextResponse } from "next/server";
import * as jwt from "jsonwebtoken";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
const JWT_SECRET = process.env.JWT_SECRET as string;

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  // Strict rate limit: 5 attempts per 15 minutes per IP
  if (!checkRateLimit(`admin-login:${getClientIp(req)}`, { windowMs: 15 * 60_000, max: 5 })) {
    return NextResponse.json({ error: "Too many attempts — try again later" }, { status: 429 });
  }
  if (!ADMIN_PASSWORD) {
    return NextResponse.json({ error: "Admin not configured" }, { status: 503 });
  }
  const { password } = await req.json();
  if (password !== ADMIN_PASSWORD) {
    return NextResponse.json({ error: "Invalid password" }, { status: 401 });
  }
  const token = jwt.sign({ role: "admin" }, JWT_SECRET, { algorithm: "HS256", expiresIn: "8h" });
  const res = NextResponse.json({ ok: true });
  res.cookies.set("ted_admin", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production" && req.url.startsWith("https"),
    sameSite: "lax",
    maxAge: 60 * 60 * 8,
    path: "/",
  });
  return res;
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.delete("ted_admin");
  return res;
}
