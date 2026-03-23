import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const presentations = await prisma.presentation.findMany({
    where: { userId: session.user.id },
    orderBy: { updatedAt: "desc" },
    include: {
      slides: {
        orderBy: { order: "asc" },
        take: 1,
        select: { id: true, content: true, background: true },
      },
      _count: { select: { slides: true } },
    },
  });

  return NextResponse.json(presentations);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));

  const presentation = await prisma.presentation.create({
    data: {
      title: body.title || "Untitled Presentation",
      theme: body.theme || "default",
      userId: session.user.id,
      slides: {
        create: [
          {
            order: 0,
            layout: "title",
            background: "#000000",
            content: {
              elements: [
                {
                  id: "title",
                  type: "text",
                  x: 10,
                  y: 35,
                  width: 80,
                  height: 20,
                  content: "Untitled Presentation",
                  fontSize: 48,
                  fontWeight: "bold",
                  textAlign: "center",
                  color: "#ffffff",
                },
                {
                  id: "subtitle",
                  type: "text",
                  x: 20,
                  y: 58,
                  width: 60,
                  height: 10,
                  content: "Click to edit",
                  fontSize: 24,
                  fontWeight: "normal",
                  textAlign: "center",
                  color: "#a0a0a0",
                },
              ],
            },
          },
        ],
      },
    },
    include: {
      slides: { orderBy: { order: "asc" } },
    },
  });

  return NextResponse.json(presentation);
}
