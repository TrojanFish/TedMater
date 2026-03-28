import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import * as jwt from "jsonwebtoken";
import { cookies } from "next/headers";

export const dynamic = "force-dynamic";

const JWT_SECRET = process.env.JWT_SECRET as string;

async function getUser() {
  const cookieStore = await cookies();
  const token = cookieStore.get("ted_session")?.value;
  if (!token) return null;
  try {
    const decoded = jwt.verify(token, JWT_SECRET, { algorithms: ["HS256"] }) as { userId: string };
    return prisma.user.findUnique({ where: { id: decoded.userId } });
  } catch { return null; }
}

// GET /api/user/notes?key={talkKey} — return notes for a specific talk
export async function GET(req: NextRequest) {
  try {
    const user = await getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const talkKey = req.nextUrl.searchParams.get("key");
    if (!talkKey) return NextResponse.json({ error: "Missing key" }, { status: 400 });

    const row = await prisma.talkNote.findUnique({
      where: { userId_talkKey: { userId: user.id, talkKey } },
    });

    return NextResponse.json({ notes: row ? row.notes : {} });
  } catch (err) {
    console.error("[Notes API Error]", err);
    return NextResponse.json({ error: "Failed to fetch notes" }, { status: 500 });
  }
}

// POST /api/user/notes — upsert notes for a talk
export async function POST(req: NextRequest) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { talkKey, notes } = body;
  if (typeof talkKey !== "string" || !talkKey || typeof notes !== "object") {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  await prisma.talkNote.upsert({
    where: { userId_talkKey: { userId: user.id, talkKey } },
    update: { notes },
    create: { userId: user.id, talkKey, notes },
  });

  return NextResponse.json({ ok: true });
}
