import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { requireOrgRole } from "@/lib/org";

// GET — List members
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { orgId } = await params;

  const membership = await prisma.orgMember.findUnique({
    where: { orgId_userId: { orgId, userId: session.user.id } },
  });
  if (!membership) {
    return NextResponse.json({ error: "Not a member" }, { status: 403 });
  }

  const members = await prisma.orgMember.findMany({
    where: { orgId },
    include: {
      user: { select: { id: true, name: true, email: true } },
    },
    orderBy: { joinedAt: "asc" },
  });

  return NextResponse.json({ members });
}

// PATCH — Update member role or title (admin+)
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { orgId } = await params;
  const admin = await requireOrgRole(session.user.id, orgId, "ADMIN");
  if (!admin) {
    return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
  }

  const { memberId, role, title } = await req.json();
  if (!memberId) {
    return NextResponse.json({ error: "memberId required" }, { status: 400 });
  }

  // Can't change owner role unless you are owner
  const target = await prisma.orgMember.findUnique({ where: { id: memberId } });
  if (!target || target.orgId !== orgId) {
    return NextResponse.json({ error: "Member not found" }, { status: 404 });
  }

  if (target.role === "OWNER" && admin.role !== "OWNER") {
    return NextResponse.json({ error: "Cannot modify owner" }, { status: 403 });
  }

  if (role === "OWNER" && admin.role !== "OWNER") {
    return NextResponse.json({ error: "Only owner can transfer ownership" }, { status: 403 });
  }

  const updated = await prisma.orgMember.update({
    where: { id: memberId },
    data: {
      ...(role && { role }),
      ...(title !== undefined && { title: title || null }),
    },
    include: { user: { select: { id: true, name: true, email: true } } },
  });

  return NextResponse.json({ member: updated });
}

// DELETE — Remove member (admin+)
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { orgId } = await params;
  const { searchParams } = new URL(req.url);
  const memberId = searchParams.get("memberId");

  if (!memberId) {
    return NextResponse.json({ error: "memberId required" }, { status: 400 });
  }

  const target = await prisma.orgMember.findUnique({ where: { id: memberId } });
  if (!target || target.orgId !== orgId) {
    return NextResponse.json({ error: "Member not found" }, { status: 404 });
  }

  // Members can remove themselves (leave org)
  if (target.userId === session.user.id) {
    if (target.role === "OWNER") {
      return NextResponse.json({ error: "Owner cannot leave. Transfer ownership first." }, { status: 400 });
    }
    await prisma.orgMember.delete({ where: { id: memberId } });
    return NextResponse.json({ success: true });
  }

  // Otherwise need admin+
  const admin = await requireOrgRole(session.user.id, orgId, "ADMIN");
  if (!admin) {
    return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
  }

  if (target.role === "OWNER") {
    return NextResponse.json({ error: "Cannot remove owner" }, { status: 403 });
  }

  await prisma.orgMember.delete({ where: { id: memberId } });
  return NextResponse.json({ success: true });
}
