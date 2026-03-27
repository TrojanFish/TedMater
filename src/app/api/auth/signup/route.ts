import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import * as bcrypt from "bcryptjs";
import * as jwt from "jsonwebtoken";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";

const JWT_SECRET = process.env.JWT_SECRET as string;
if (!JWT_SECRET) throw new Error("JWT_SECRET environment variable is not set");

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  if (!checkRateLimit(`signup:${getClientIp(req)}`, { windowMs: 60_000, max: 5 })) {
    return NextResponse.json({ error: "Too many signup attempts" }, { status: 429 });
  }

  try {
    const { email, password, activationCode } = await req.json();

    if (!email || !password) {
      return NextResponse.json({ error: "Email and password are required" }, { status: 400 });
    }
    // Email format
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: "Invalid email format" }, { status: 400 });
    }
    // Password: at least 8 chars, not all whitespace
    if (typeof password !== "string" || password.trim().length < 8) {
      return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 });
    }
    if (!activationCode) {
      return NextResponse.json({ error: "Activation code is required" }, { status: 400 });
    }

    // Validate activation code
    const code = await prisma.activationCode.findUnique({ where: { code: activationCode } });
    if (!code) {
      return NextResponse.json({ error: "Invalid activation code" }, { status: 400 });
    }
    if (code.usedById) {
      return NextResponse.json({ error: "Activation code has already been used" }, { status: 400 });
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json({ error: "User already exists" }, { status: 400 });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    // Create user and mark code as used in a transaction
    const user = await prisma.$transaction(async (tx) => {
      const newUser = await tx.user.create({
        data: { email, passwordHash, credits: 100 },
      });
      await tx.activationCode.update({
        where: { id: code.id },
        data: { usedById: newUser.id, usedAt: new Date() },
      });
      return newUser;
    });

    const token = jwt.sign({ userId: user.id, email: user.email }, JWT_SECRET, { algorithm: "HS256", expiresIn: "7d" });

    const response = NextResponse.json({
      user: { id: user.id, email: user.email, credits: user.credits },
    });

    response.cookies.set("ted_session", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production" && req.url.startsWith("https"),
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 7,
      path: "/",
    });

    return response;
  } catch (error: any) {
    console.error("[SIGNUP ERROR]", error);
    return NextResponse.json({
      error: error.message || "Internal Server Error",
      stack: process.env.NODE_ENV === "development" ? error.stack : undefined,
    }, { status: 500 });
  }
}
