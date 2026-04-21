import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

const ITEMS_PER_PAGE = 20;

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { isAdmin: true },
  });

  if (!admin?.isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const page = parseInt(searchParams.get("page") || "1");
  const search = searchParams.get("search") || "";
  const verified = searchParams.get("verified");

  const where: any = {};

  if (search) {
    where.OR = [
      { email: { contains: search, mode: "insensitive" } },
      { name: { contains: search, mode: "insensitive" } },
    ];
  }

  if (verified === "true") {
    where.emailVerified = true;
  } else if (verified === "false") {
    where.emailVerified = false;
  }

  const skip = (page - 1) * ITEMS_PER_PAGE;

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      select: {
        id: true,
        email: true,
        name: true,
        emailVerified: true,
        isAdmin: true,
        createdAt: true,
        updatedAt: true,
        storageUsed: true,
        storageLimit: true,
        _count: {
          select: {
            files: true,
            folders: true,
            documents: true,
            presentations: true,
            mailboxes: true,
            orgMemberships: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      skip,
      take: ITEMS_PER_PAGE,
    }),
    prisma.user.count({ where }),
  ]);

  const formattedUsers = users.map((user) => ({
    ...user,
    storageUsed: Number(user.storageUsed),
  }));

  return NextResponse.json({
    users: formattedUsers,
    pagination: {
      page,
      totalPages: Math.ceil(total / ITEMS_PER_PAGE),
      total,
      perPage: ITEMS_PER_PAGE,
    },
  });
}
