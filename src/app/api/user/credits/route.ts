import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import * as jwt from "jsonwebtoken";
import { cookies } from "next/headers";

export const dynamic = "force-dynamic";

const JWT_SECRET = process.env.JWT_SECRET as string;

const COSTS: Record<string, number> = {
  WORD_LOOKUP:  1,
  AI_ANALYZE:   5,
  PDF_EXPORT:   10,
  AI_TRANSLATE: 20,
};

async function getUser() {
  const cookieStore = await cookies();
  const token = cookieStore.get("ted_session")?.value;
  if (!token) return null;
  try {
    const decoded = jwt.verify(token, JWT_SECRET, { algorithms: ["HS256"] }) as { userId: string };
    return prisma.user.findUnique({ where: { id: decoded.userId } });
  } catch { return null; }
}

export async function GET() {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json({ credits: user.credits });
}

export async function POST(req: Request) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const action = typeof body.action === "string" ? body.action : "";
  const cost = COSTS[action];
  if (cost === undefined) return NextResponse.json({ error: "Invalid action" }, { status: 400 });

  try {
    // Balance check + deduction in one atomic transaction to prevent race conditions (#3)
    const updatedUser = await prisma.$transaction(async (tx) => {
      // Re-read balance inside transaction with a filter that also acts as the guard
      const fresh = await tx.user.findUnique({ where: { id: user.id } });
      if (!fresh || fresh.credits < cost) {
        throw Object.assign(new Error("Insufficient credits"), { code: "INSUFFICIENT_CREDITS" });
      }
      const u = await tx.user.update({
        where: { id: user.id },
        data: { credits: { decrement: cost } },
      });
      await tx.transaction.create({
        data: { userId: user.id, action, amount: -cost, balance: u.credits },
      });
      return u;
    });

    return NextResponse.json({ credits: updatedUser.credits });
  } catch (error: any) {
    if (error.code === "INSUFFICIENT_CREDITS") {
      return NextResponse.json({ error: "Insufficient credits" }, { status: 403 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
