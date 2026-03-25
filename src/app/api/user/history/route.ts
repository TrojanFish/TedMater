import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import * as jwt from "jsonwebtoken";
import { cookies } from "next/headers";

export const dynamic = "force-dynamic";

const JWT_SECRET = process.env.JWT_SECRET || "TEDMASTER-SUPER-SECRET-123";

// === Authenticate Function ===
async function auth() {
  const cookieStore = await cookies();
  const token = cookieStore.get("ted_session")?.value;
  if (!token) return null;
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string };
    const user = await prisma.user.findUnique({ where: { id: decoded.userId } });
    return user;
  } catch (err) {
    return null;
  }
}

// GET history list
export async function GET() {
  try {
    const user = await auth();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const history = await prisma.history.findMany({
      where: { userId: user.id },
      orderBy: { updatedAt: "desc" },
      take: 20
    });
    return NextResponse.json(history);
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Failed to fetch history" }, { status: 500 });
  }
}

// POST update history
export async function POST(req: Request) {
  try {
    const user = await auth();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const { videoUrl, title, presenter, progressTime, duration } = body;

    if (!videoUrl) return NextResponse.json({ error: "Missing videoUrl" }, { status: 400 });

    const record = await prisma.history.upsert({
      where: {
        userId_videoUrl: {
          userId: user.id,
          videoUrl: videoUrl,
        }
      },
      update: {
        title,
        presenter,
        progressTime: progressTime || 0,
        duration: duration || null,
        updatedAt: new Date() // Force timestamp update
      },
      create: {
        userId: user.id,
        videoUrl,
        title: title || "Unknown TED Talk",
        presenter: presenter || "Unknown",
        progressTime: progressTime || 0,
        duration: duration || null
      }
    });

    return NextResponse.json({ success: true, record });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Update failed" }, { status: 500 });
  }
}
