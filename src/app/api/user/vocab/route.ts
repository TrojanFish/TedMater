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

// GET /api/user/vocab — return all vocab words for the logged-in user
export async function GET() {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rows = await prisma.vocabWord.findMany({
    where: { userId: user.id },
    orderBy: { addedAt: "asc" },
  });
  // Return the stored VocabItem objects directly
  return NextResponse.json({ words: rows.map(r => r.data) });
}

// POST /api/user/vocab — upsert a vocab word
export async function POST(req: NextRequest) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { word, data } = body;
  if (typeof word !== "string" || !word.trim()) {
    return NextResponse.json({ error: "Invalid word" }, { status: 400 });
  }

  await prisma.vocabWord.upsert({
    where: { userId_word: { userId: user.id, word } },
    update: { data },
    create: { userId: user.id, word, data },
  });

  return NextResponse.json({ ok: true });
}

// DELETE /api/user/vocab — remove a vocab word
export async function DELETE(req: NextRequest) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { word } = body;
  if (typeof word !== "string") {
    return NextResponse.json({ error: "Invalid word" }, { status: 400 });
  }

  await prisma.vocabWord.deleteMany({
    where: { userId: user.id, word },
  });

  return NextResponse.json({ ok: true });
}
