import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

// POST — Accept an invite by token
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { token } = await req.json();
  if (!token) {
    return NextResponse.json({ error: "Token required" }, { status: 400 });
  }

  const invite = await prisma.orgInvite.findUnique({
    where: { token },
    include: { org: { select: { id: true, name: true, slug: true } } },
  });

  if (!invite) {
    return NextResponse.json({ error: "Invalid invite" }, { status: 404 });
  }

  if (invite.acceptedAt) {
    return NextResponse.json({ error: "Invite already used" }, { status: 409 });
  }

  if (invite.expiresAt < new Date()) {
    return NextResponse.json({ error: "Invite expired" }, { status: 410 });
  }

  // Check user email matches invite email
  const user = await prisma.user.findUnique({ where: { id: session.user.id } });
  if (!user || user.email !== invite.email) {
    return NextResponse.json(
      { error: "This invite was sent to a different email address" },
      { status: 403 }
    );
  }

  // Check if already a member
  const existing = await prisma.orgMember.findUnique({
    where: { orgId_userId: { orgId: invite.orgId, userId: session.user.id } },
  });
  if (existing) {
    // Mark invite as accepted anyway
    await prisma.orgInvite.update({ where: { id: invite.id }, data: { acceptedAt: new Date() } });
    return NextResponse.json({ organization: invite.org, alreadyMember: true });
  }

  // Create membership and mark invite as accepted
  await prisma.$transaction([
    prisma.orgMember.create({
      data: {
        orgId: invite.orgId,
        userId: session.user.id,
        role: invite.role,
      },
    }),
    prisma.orgInvite.update({
      where: { id: invite.id },
      data: { acceptedAt: new Date() },
    }),
  ]);

  return NextResponse.json({ organization: invite.org, joined: true });
}
