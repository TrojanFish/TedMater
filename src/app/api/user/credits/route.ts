import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import * as jwt from "jsonwebtoken";
import { cookies } from "next/headers";

export const dynamic = "force-dynamic";

const JWT_SECRET = process.env.JWT_SECRET as string;
if (!JWT_SECRET) throw new Error("JWT_SECRET environment variable is not set");

async function getUser() {
  const cookieStore = await cookies();
  const token = cookieStore.get("ted_session")?.value;
  if (!token) return null;
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string };
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

  const { action } = await req.json();

  const COSTS: Record<string, number> = {
    "WORD_LOOKUP": 1,
    "AI_ANALYZE": 5,
    "PDF_EXPORT": 10,
    "AI_TRANSLATE": 20,
  };

  const cost = COSTS[action];
  if (cost === undefined) return NextResponse.json({ error: "Invalid action" }, { status: 400 });

  if (user.credits < cost) {
    return NextResponse.json({ error: "Insufficient credits" }, { status: 403 });
  }

  // Use transaction to ensure consistency
  try {
    const updatedUser = await prisma.$transaction(async (tx: any) => {
      const u = await tx.user.update({
        where: { id: user.id },
        data: { credits: { decrement: cost } }
      });

      await tx.transaction.create({
        data: {
          userId: user.id,
          action,
          amount: -cost,
          balance: u.credits
        }
      });

      return u;
    });

    return NextResponse.json({ credits: updatedUser.credits });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
