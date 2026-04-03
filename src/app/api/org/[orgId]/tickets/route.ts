import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { requireOrgRole, getNextTicketNumber } from "@/lib/org";

// GET — List tickets with filters
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { orgId } = await params;
  const membership = await requireOrgRole(session.user.id, orgId, "MEMBER");
  if (!membership) {
    return NextResponse.json({ error: "Not a member" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");
  const priority = searchParams.get("priority");
  const assigneeId = searchParams.get("assigneeId");
  const search = searchParams.get("search");
  const page = parseInt(searchParams.get("page") || "1");
  const limit = Math.min(parseInt(searchParams.get("limit") || "25"), 50);

  const where: any = { orgId };
  if (status) where.status = status;
  if (priority) where.priority = priority;
  if (assigneeId) where.assigneeId = assigneeId === "unassigned" ? null : assigneeId;
  if (search) {
    where.OR = [
      { title: { contains: search, mode: "insensitive" } },
      { description: { contains: search, mode: "insensitive" } },
    ];
  }

  const [tickets, total] = await Promise.all([
    prisma.ticket.findMany({
      where,
      include: {
        creator: { select: { id: true, name: true, email: true } },
        assignee: { select: { id: true, name: true, email: true } },
        _count: { select: { messages: true } },
      },
      orderBy: [{ priority: "desc" }, { updatedAt: "desc" }],
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.ticket.count({ where }),
  ]);

  // Stats
  const stats = await prisma.ticket.groupBy({
    by: ["status"],
    where: { orgId },
    _count: { id: true },
  });
  const statusCounts = Object.fromEntries(stats.map((s) => [s.status, s._count.id]));

  return NextResponse.json({
    tickets,
    total,
    page,
    totalPages: Math.ceil(total / limit),
    stats: statusCounts,
  });
}

// POST — Create a ticket
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { orgId } = await params;
  const membership = await requireOrgRole(session.user.id, orgId, "MEMBER");
  if (!membership) {
    return NextResponse.json({ error: "Not a member" }, { status: 403 });
  }

  const { title, description, priority, assigneeId, tags, emailId, dueDate } = await req.json();
  if (!title) {
    return NextResponse.json({ error: "Title required" }, { status: 400 });
  }

  // Validate assignee is a member
  if (assigneeId) {
    const assigneeMembership = await prisma.orgMember.findUnique({
      where: { orgId_userId: { orgId, userId: assigneeId } },
    });
    if (!assigneeMembership) {
      return NextResponse.json({ error: "Assignee is not a member" }, { status: 400 });
    }
  }

  const number = await getNextTicketNumber(orgId);

  const ticket = await prisma.ticket.create({
    data: {
      orgId,
      number,
      title: title.trim(),
      description: description?.trim() || null,
      priority: priority || "MEDIUM",
      creatorId: session.user.id,
      assigneeId: assigneeId || null,
      tags: tags || null,
      emailId: emailId || null,
      dueDate: dueDate ? new Date(dueDate) : null,
    },
    include: {
      creator: { select: { id: true, name: true, email: true } },
      assignee: { select: { id: true, name: true, email: true } },
    },
  });

  return NextResponse.json({ ticket }, { status: 201 });
}

// PATCH — Update ticket
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { orgId } = await params;
  const membership = await requireOrgRole(session.user.id, orgId, "MEMBER");
  if (!membership) {
    return NextResponse.json({ error: "Not a member" }, { status: 403 });
  }

  const { ticketId, title, description, status, priority, assigneeId, tags, dueDate } = await req.json();
  if (!ticketId) {
    return NextResponse.json({ error: "ticketId required" }, { status: 400 });
  }

  const ticket = await prisma.ticket.findUnique({ where: { id: ticketId } });
  if (!ticket || ticket.orgId !== orgId) {
    return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
  }

  const data: any = {};
  if (title !== undefined) data.title = title.trim();
  if (description !== undefined) data.description = description?.trim() || null;
  if (priority !== undefined) data.priority = priority;
  if (tags !== undefined) data.tags = tags;
  if (dueDate !== undefined) data.dueDate = dueDate ? new Date(dueDate) : null;
  if (assigneeId !== undefined) data.assigneeId = assigneeId || null;

  if (status !== undefined) {
    data.status = status;
    if (status === "RESOLVED" && !ticket.resolvedAt) data.resolvedAt = new Date();
    if (status === "CLOSED" && !ticket.closedAt) data.closedAt = new Date();
    if (status === "OPEN" || status === "IN_PROGRESS") {
      data.resolvedAt = null;
      data.closedAt = null;
    }
  }

  const updated = await prisma.ticket.update({
    where: { id: ticketId },
    data,
    include: {
      creator: { select: { id: true, name: true, email: true } },
      assignee: { select: { id: true, name: true, email: true } },
      _count: { select: { messages: true } },
    },
  });

  return NextResponse.json({ ticket: updated });
}

// DELETE — Delete ticket (admin+)
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { orgId } = await params;
  const membership = await requireOrgRole(session.user.id, orgId, "ADMIN");
  if (!membership) {
    return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const ticketId = searchParams.get("ticketId");
  if (!ticketId) {
    return NextResponse.json({ error: "ticketId required" }, { status: 400 });
  }

  const ticket = await prisma.ticket.findUnique({ where: { id: ticketId } });
  if (!ticket || ticket.orgId !== orgId) {
    return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
  }

  await prisma.ticket.delete({ where: { id: ticketId } });
  return NextResponse.json({ success: true });
}
