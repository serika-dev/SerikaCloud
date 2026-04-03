import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { requireOrgRole } from "@/lib/org";

// GET — List pending invites
export async function GET(
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

  const invites = await prisma.orgInvite.findMany({
    where: { orgId, acceptedAt: null, expiresAt: { gt: new Date() } },
    include: { invitedBy: { select: { name: true, email: true } } },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ invites });
}

// POST — Create invite (admin+)
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

  const { email, role } = await req.json();
  if (!email) {
    return NextResponse.json({ error: "Email required" }, { status: 400 });
  }

  // Check if user is already a member
  const existingUser = await prisma.user.findUnique({ where: { email } });
  if (existingUser) {
    const existingMember = await prisma.orgMember.findUnique({
      where: { orgId_userId: { orgId, userId: existingUser.id } },
    });
    if (existingMember) {
      return NextResponse.json({ error: "User is already a member" }, { status: 409 });
    }
  }

  // Check for existing pending invite
  const existingInvite = await prisma.orgInvite.findFirst({
    where: { orgId, email, acceptedAt: null, expiresAt: { gt: new Date() } },
  });
  if (existingInvite) {
    return NextResponse.json({ error: "Invite already pending for this email" }, { status: 409 });
  }

  // Admins can only invite members, not other admins
  const inviteRole = role === "ADMIN" && membership.role === "OWNER" ? "ADMIN" : "MEMBER";

  const invite = await prisma.orgInvite.create({
    data: {
      orgId,
      email,
      role: inviteRole,
      invitedById: session.user.id,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
    },
    include: {
      org: { select: { name: true, slug: true } },
      invitedBy: { select: { name: true } },
    },
  });

  // TODO: Send invite email via SES

  return NextResponse.json({ invite }, { status: 201 });
}

// DELETE — Revoke invite
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
  const inviteId = searchParams.get("inviteId");
  if (!inviteId) {
    return NextResponse.json({ error: "inviteId required" }, { status: 400 });
  }

  const invite = await prisma.orgInvite.findUnique({ where: { id: inviteId } });
  if (!invite || invite.orgId !== orgId) {
    return NextResponse.json({ error: "Invite not found" }, { status: 404 });
  }

  await prisma.orgInvite.delete({ where: { id: inviteId } });
  return NextResponse.json({ success: true });
}
