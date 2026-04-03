import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

// GET — List user's organizations
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const memberships = await prisma.orgMember.findMany({
    where: { userId: session.user.id },
    include: {
      org: {
        include: {
          _count: { select: { members: true, domains: true, groups: true } },
        },
      },
    },
    orderBy: { joinedAt: "desc" },
  });

  return NextResponse.json({
    organizations: memberships.map((m) => ({
      ...m.org,
      role: m.role,
      title: m.title,
      memberCount: m.org._count.members,
      domainCount: m.org._count.domains,
      groupCount: m.org._count.groups,
    })),
  });
}

// POST — Create a new organization
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { name, slug, description } = await req.json();

  if (!name || !slug) {
    return NextResponse.json({ error: "Name and slug are required" }, { status: 400 });
  }

  // Validate slug format
  const cleanSlug = slug.toLowerCase().trim();
  if (!/^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$/.test(cleanSlug)) {
    return NextResponse.json(
      { error: "Invalid slug. Use 3-40 characters: lowercase letters, numbers, hyphens." },
      { status: 400 }
    );
  }

  // Reserved slugs
  const reserved = ["admin", "api", "app", "www", "mail", "cloud", "write", "present", "system", "support", "help"];
  if (reserved.includes(cleanSlug)) {
    return NextResponse.json({ error: "This slug is reserved" }, { status: 409 });
  }

  // Check if slug is taken
  const existing = await prisma.organization.findUnique({ where: { slug: cleanSlug } });
  if (existing) {
    return NextResponse.json({ error: "This slug is already taken" }, { status: 409 });
  }

  const org = await prisma.organization.create({
    data: {
      name: name.trim(),
      slug: cleanSlug,
      description: description?.trim() || null,
      members: {
        create: {
          userId: session.user.id,
          role: "OWNER",
        },
      },
    },
    include: {
      members: { include: { user: { select: { id: true, name: true, email: true } } } },
    },
  });

  return NextResponse.json({ organization: org }, { status: 201 });
}

// PATCH — Update organization details (admin+)
export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { orgId, name, description, avatarUrl } = await req.json();
  if (!orgId) {
    return NextResponse.json({ error: "orgId required" }, { status: 400 });
  }

  const membership = await prisma.orgMember.findUnique({
    where: { orgId_userId: { orgId, userId: session.user.id } },
  });

  if (!membership || membership.role === "MEMBER") {
    return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
  }

  const updated = await prisma.organization.update({
    where: { id: orgId },
    data: {
      ...(name !== undefined && { name: name.trim() }),
      ...(description !== undefined && { description: description?.trim() || null }),
      ...(avatarUrl !== undefined && { avatarUrl }),
    },
  });

  return NextResponse.json({ organization: updated });
}

// DELETE — Delete organization (owner only)
export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const orgId = searchParams.get("orgId");
  if (!orgId) {
    return NextResponse.json({ error: "orgId required" }, { status: 400 });
  }

  const membership = await prisma.orgMember.findUnique({
    where: { orgId_userId: { orgId, userId: session.user.id } },
  });

  if (!membership || membership.role !== "OWNER") {
    return NextResponse.json({ error: "Only the owner can delete an organization" }, { status: 403 });
  }

  await prisma.organization.delete({ where: { id: orgId } });

  return NextResponse.json({ success: true });
}
