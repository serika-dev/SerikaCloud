import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { requireOrgRole } from "@/lib/org";

// GET — Get ticket with messages
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ orgId: string; ticketId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { orgId, ticketId } = await params;
  const membership = await requireOrgRole(session.user.id, orgId, "MEMBER");
  if (!membership) {
    return NextResponse.json({ error: "Not a member" }, { status: 403 });
  }

  const ticket = await prisma.ticket.findUnique({
    where: { id: ticketId },
    include: {
      creator: { select: { id: true, name: true, email: true } },
      assignee: { select: { id: true, name: true, email: true } },
      messages: {
        include: {
          author: { select: { id: true, name: true, email: true } },
        },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!ticket || ticket.orgId !== orgId) {
    return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
  }

  return NextResponse.json({ ticket });
}

// POST — Add a message/comment to ticket
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ orgId: string; ticketId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { orgId, ticketId } = await params;
  const membership = await requireOrgRole(session.user.id, orgId, "MEMBER");
  if (!membership) {
    return NextResponse.json({ error: "Not a member" }, { status: 403 });
  }

  const { content, isInternal } = await req.json();
  if (!content?.trim()) {
    return NextResponse.json({ error: "Content required" }, { status: 400 });
  }

  const ticket = await prisma.ticket.findUnique({ where: { id: ticketId } });
  if (!ticket || ticket.orgId !== orgId) {
    return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
  }

  const message = await prisma.ticketMessage.create({
    data: {
      ticketId,
      authorId: session.user.id,
      content: content.trim(),
      isInternal: !!isInternal,
    },
    include: {
      author: { select: { id: true, name: true, email: true } },
    },
  });

  // Touch ticket updatedAt
  await prisma.ticket.update({
    where: { id: ticketId },
    data: { updatedAt: new Date() },
  });

  return NextResponse.json({ message }, { status: 201 });
}
