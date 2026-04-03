import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { requireOrgRole } from "@/lib/org";

// GET — List groups in org
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

  const groups = await prisma.userGroup.findMany({
    where: { orgId },
    include: {
      members: {
        include: { user: { select: { id: true, name: true, email: true } } },
      },
      mailbox: { select: { id: true, address: true, displayName: true } },
      _count: { select: { members: true } },
    },
    orderBy: { name: "asc" },
  });

  return NextResponse.json({ groups });
}

// POST — Create a group (admin+)
export async function POST(
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

  const { name, description, color, memberIds } = await req.json();
  if (!name) {
    return NextResponse.json({ error: "Group name required" }, { status: 400 });
  }

  // Check for duplicate name
  const existing = await prisma.userGroup.findUnique({
    where: { orgId_name: { orgId, name: name.trim() } },
  });
  if (existing) {
    return NextResponse.json({ error: "Group name already exists" }, { status: 409 });
  }

  const group = await prisma.userGroup.create({
    data: {
      orgId,
      name: name.trim(),
      description: description?.trim() || null,
      color: color || "#6366f1",
      ...(memberIds?.length && {
        members: {
          create: memberIds.map((userId: string) => ({ userId })),
        },
      }),
    },
    include: {
      members: {
        include: { user: { select: { id: true, name: true, email: true } } },
      },
      _count: { select: { members: true } },
    },
  });

  return NextResponse.json({ group }, { status: 201 });
}

// PATCH — Update group (admin+)
export async function PATCH(
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

  const { groupId, name, description, color, addMemberIds, removeMemberIds } = await req.json();
  if (!groupId) {
    return NextResponse.json({ error: "groupId required" }, { status: 400 });
  }

  const group = await prisma.userGroup.findUnique({ where: { id: groupId } });
  if (!group || group.orgId !== orgId) {
    return NextResponse.json({ error: "Group not found" }, { status: 404 });
  }

  // Update group info
  await prisma.userGroup.update({
    where: { id: groupId },
    data: {
      ...(name && { name: name.trim() }),
      ...(description !== undefined && { description: description?.trim() || null }),
      ...(color && { color }),
    },
  });

  // Add members
  if (addMemberIds?.length) {
    for (const userId of addMemberIds) {
      await prisma.groupMember.upsert({
        where: { groupId_userId: { groupId, userId } },
        create: { groupId, userId },
        update: {},
      });
    }
  }

  // Remove members
  if (removeMemberIds?.length) {
    await prisma.groupMember.deleteMany({
      where: { groupId, userId: { in: removeMemberIds } },
    });
  }

  const updated = await prisma.userGroup.findUnique({
    where: { id: groupId },
    include: {
      members: {
        include: { user: { select: { id: true, name: true, email: true } } },
      },
      mailbox: { select: { id: true, address: true } },
      _count: { select: { members: true } },
    },
  });

  return NextResponse.json({ group: updated });
}

// DELETE — Delete group (admin+)
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
  const groupId = searchParams.get("groupId");
  if (!groupId) {
    return NextResponse.json({ error: "groupId required" }, { status: 400 });
  }

  const group = await prisma.userGroup.findUnique({ where: { id: groupId } });
  if (!group || group.orgId !== orgId) {
    return NextResponse.json({ error: "Group not found" }, { status: 404 });
  }

  await prisma.userGroup.delete({ where: { id: groupId } });
  return NextResponse.json({ success: true });
}
