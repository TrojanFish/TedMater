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

// GET /api/user/sentences — return all saved sentences
export async function GET() {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rows = await prisma.userSentence.findMany({
    where: { userId: user.id },
    orderBy: { addedAt: "asc" },
  });
  return NextResponse.json({ sentences: rows.map(r => r.data) });
}

// POST /api/user/sentences — upsert a saved sentence
export async function POST(req: NextRequest) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { sentenceKey, data } = body;
  if (typeof sentenceKey !== "string" || !sentenceKey) {
    return NextResponse.json({ error: "Invalid sentenceKey" }, { status: 400 });
  }

  await prisma.userSentence.upsert({
    where: { userId_sentenceKey: { userId: user.id, sentenceKey } },
    update: { data },
    create: { userId: user.id, sentenceKey, data },
  });

  return NextResponse.json({ ok: true });
}

// DELETE /api/user/sentences — remove a saved sentence
export async function DELETE(req: NextRequest) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { sentenceKey } = body;
  if (typeof sentenceKey !== "string") {
    return NextResponse.json({ error: "Invalid sentenceKey" }, { status: 400 });
  }

  await prisma.userSentence.deleteMany({
    where: { userId: user.id, sentenceKey },
  });

  return NextResponse.json({ ok: true });
}
