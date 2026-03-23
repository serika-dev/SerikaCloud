import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { nanoid } from "nanoid";

// POST — generate or return share link
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const pres = await prisma.presentation.findFirst({
    where: { id, userId: session.user.id },
  });

  if (!pres) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (pres.shareId) {
    return NextResponse.json({ shareId: pres.shareId });
  }

  const shareId = nanoid(12);
  await prisma.presentation.update({
    where: { id },
    data: { shareId },
  });

  return NextResponse.json({ shareId });
}

// DELETE — revoke share link
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const pres = await prisma.presentation.findFirst({
    where: { id, userId: session.user.id },
  });

  if (!pres) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await prisma.presentation.update({
    where: { id },
    data: { shareId: null },
  });

  return NextResponse.json({ success: true });
}
