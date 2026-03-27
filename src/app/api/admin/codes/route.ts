import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/adminAuth";
import { randomBytes } from "crypto";

export const dynamic = "force-dynamic";

function generateCode(): string {
  return randomBytes(6).toString("hex").toUpperCase().match(/.{4}/g)!.join("-");
}

export async function GET() {
  const auth = await requireAdmin();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const codes = await prisma.activationCode.findMany({
    orderBy: { createdAt: "desc" },
    include: { usedBy: { select: { email: true } } },
  });
  return NextResponse.json({ codes });
}

export async function POST(req: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { count = 1, note } = await req.json().catch(() => ({}));
  const n = Math.min(Math.max(1, Number(count) || 1), 100);

  const created = await prisma.$transaction(
    Array.from({ length: n }, () =>
      prisma.activationCode.create({
        data: { code: generateCode(), note: note || null },
      })
    )
  );

  return NextResponse.json({ codes: created });
}

export async function DELETE(req: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { id } = await req.json();
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const code = await prisma.activationCode.findUnique({ where: { id } });
  if (!code) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (code.usedById) return NextResponse.json({ error: "Cannot delete a used code" }, { status: 400 });

  await prisma.activationCode.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
