import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = await req.json().catch(() => ({}));

  const presentation = await prisma.presentation.findFirst({
    where: { id, userId: session.user.id },
    include: { slides: { orderBy: { order: "desc" }, take: 1 } },
  });

  if (!presentation) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const nextOrder = (presentation.slides[0]?.order ?? -1) + 1;

  const slide = await prisma.slide.create({
    data: {
      presentationId: id,
      order: body.order ?? nextOrder,
      layout: body.layout || "blank",
      background: body.background || "#000000",
      content: body.content || {
        elements: [
          {
            id: "title",
            type: "text",
            x: 10,
            y: 40,
            width: 80,
            height: 15,
            content: "New Slide",
            fontSize: 36,
            fontWeight: "bold",
            textAlign: "center",
            color: "#ffffff",
          },
        ],
      },
      notes: body.notes || null,
    },
  });

  // Update presentation timestamp
  await prisma.presentation.update({
    where: { id },
    data: { updatedAt: new Date() },
  });

  return NextResponse.json(slide);
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

  const presentation = await prisma.presentation.findFirst({
    where: { id, userId: session.user.id },
  });

  if (!presentation) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (!body.slideId) {
    return NextResponse.json({ error: "slideId required" }, { status: 400 });
  }

  const slide = await prisma.slide.update({
    where: { id: body.slideId },
    data: {
      ...(body.content !== undefined && { content: body.content }),
      ...(body.layout !== undefined && { layout: body.layout }),
      ...(body.background !== undefined && { background: body.background }),
      ...(body.notes !== undefined && { notes: body.notes }),
      ...(body.order !== undefined && { order: body.order }),
    },
  });

  await prisma.presentation.update({
    where: { id },
    data: { updatedAt: new Date() },
  });

  return NextResponse.json(slide);
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const { searchParams } = new URL(req.url);
  const slideId = searchParams.get("slideId");

  if (!slideId) {
    return NextResponse.json({ error: "slideId required" }, { status: 400 });
  }

  const presentation = await prisma.presentation.findFirst({
    where: { id, userId: session.user.id },
  });

  if (!presentation) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await prisma.slide.delete({ where: { id: slideId } });

  await prisma.presentation.update({
    where: { id },
    data: { updatedAt: new Date() },
  });

  return NextResponse.json({ success: true });
}
