import { cookies } from "next/headers";
import * as jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET as string;

export async function requireAdmin(): Promise<{ ok: true } | { ok: false; error: string; status: number }> {
  const cookieStore = await cookies();
  const token = cookieStore.get("ted_admin")?.value;
  if (!token) return { ok: false, error: "Unauthorized", status: 401 };
  try {
    const payload = jwt.verify(token, JWT_SECRET, { algorithms: ["HS256"] }) as any;
    if (payload.role !== "admin") return { ok: false, error: "Forbidden", status: 403 };
    return { ok: true };
  } catch {
    return { ok: false, error: "Invalid session", status: 401 };
  }
}
