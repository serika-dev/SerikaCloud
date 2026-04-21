import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { z } from "zod";

const storageSchema = z.object({
  storageLimit: z.number().min(0).max(1099511627776), // Max 1TB
});

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { isAdmin: true },
  });

  if (!admin?.isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  const body = await req.json();
  const validation = storageSchema.safeParse(body);

  if (!validation.success) {
    return NextResponse.json(
      { error: validation.error.issues[0].message },
      { status: 400 }
    );
  }

  const { storageLimit } = validation.data;

  const user = await prisma.user.findUnique({
    where: { id },
    select: { id: true, email: true, name: true, storageLimit: true },
  });

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  await prisma.user.update({
    where: { id },
    data: { storageLimit: BigInt(storageLimit) },
  });

  return NextResponse.json({
    success: true,
    message: `Storage limit for ${user.email} increased to ${(storageLimit / (1024 * 1024 * 1024)).toFixed(2)} GB.`,
    user: { ...user, storageLimit },
  });
}
