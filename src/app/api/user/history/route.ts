import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import * as jwt from "jsonwebtoken";
import { cookies } from "next/headers";

export const dynamic = "force-dynamic";

const JWT_SECRET = process.env.JWT_SECRET as string;
if (!JWT_SECRET) throw new Error("JWT_SECRET environment variable is not set");

async function auth() {
  const cookieStore = await cookies();
  const token = cookieStore.get("ted_session")?.value;
  if (!token) return null;
  try {
    const decoded = jwt.verify(token, JWT_SECRET, { algorithms: ["HS256"] }) as { userId: string };
    return prisma.user.findUnique({ where: { id: decoded.userId } });
  } catch { return null; }
}

export async function GET() {
  try {
    const user = await auth();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const history = await prisma.history.findMany({
      where: { userId: user.id },
      orderBy: { updatedAt: "desc" },
      take: 20,
    });
    return NextResponse.json(history);
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Failed to fetch history" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const user = await auth();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const { videoUrl, title, presenter, progressTime, duration } = body;

    // Validate required fields
    if (typeof videoUrl !== "string" || !videoUrl.includes("ted.com/talks/")) {
      return NextResponse.json({ error: "Invalid videoUrl" }, { status: 400 });
    }
    // Sanitize strings (strip to plain text, no HTML)
    const safeTitle = typeof title === "string" ? title.slice(0, 300).replace(/[<>]/g, "") : "Unknown TED Talk";
    const safePresenter = typeof presenter === "string" ? presenter.slice(0, 200).replace(/[<>]/g, "") : "Unknown";
    // Validate numbers: must be finite, non-negative
    const safeProgress = Number.isFinite(progressTime) && progressTime >= 0 ? progressTime : 0;
    const safeDuration = Number.isFinite(duration) && duration > 0 ? duration : null;

    const record = await prisma.history.upsert({
      where: { userId_videoUrl: { userId: user.id, videoUrl } },
      update: {
        title: safeTitle,
        presenter: safePresenter,
        progressTime: safeProgress,
        duration: safeDuration,
        updatedAt: new Date(),
      },
      create: {
        userId: user.id,
        videoUrl,
        title: safeTitle,
        presenter: safePresenter,
        progressTime: safeProgress,
        duration: safeDuration,
      },
    });

    return NextResponse.json({ success: true, record });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Update failed" }, { status: 500 });
  }
}
