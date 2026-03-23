import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const presentation = await prisma.presentation.findFirst({
    where: { id, userId: session.user.id },
    include: {
      slides: { orderBy: { order: "asc" } },
    },
  });

  if (!presentation) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(presentation);
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = await req.json();

  const existing = await prisma.presentation.findFirst({
    where: { id, userId: session.user.id },
  });

  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const presentation = await prisma.presentation.update({
    where: { id },
    data: {
      ...(body.title !== undefined && { title: body.title }),
      ...(body.theme !== undefined && { theme: body.theme }),
      ...(body.shareId !== undefined && { shareId: body.shareId }),
    },
    include: {
      slides: { orderBy: { order: "asc" } },
    },
  });

  return NextResponse.json(presentation);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const existing = await prisma.presentation.findFirst({
    where: { id, userId: session.user.id },
  });

  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await prisma.presentation.delete({ where: { id } });

  return NextResponse.json({ success: true });
}
