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

  const doc = await prisma.document.findFirst({
    where: { id, userId: session.user.id },
  });

  if (!doc) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (doc.shareId) {
    return NextResponse.json({ shareId: doc.shareId });
  }

  const shareId = nanoid(12);
  await prisma.document.update({
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

  const doc = await prisma.document.findFirst({
    where: { id, userId: session.user.id },
  });

  if (!doc) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await prisma.document.update({
    where: { id },
    data: { shareId: null },
  });

  return NextResponse.json({ success: true });
}
