import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const userId = session.user.id;

    const user = await prisma.$transaction(async (tx) => {
      // Use the same user lock as upload finalization. Otherwise a repair based
      // on an older file sum can overwrite a just-completed upload's usage.
      await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id" = ${userId} FOR UPDATE`;
      const current = await tx.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          name: true,
          email: true,
          storageUsed: true,
          storageLimit: true,
          isAdmin: true,
          viewPreference: true,
          createdAt: true,
        },
      });
      if (!current) return null;
      const actualUsed = await tx.file.aggregate({
        where: { userId }, _sum: { size: true },
      });
      const storageUsed = actualUsed._sum.size ?? BigInt(0);
      if (current.storageUsed !== storageUsed) {
        await tx.user.update({ where: { id: userId }, data: { storageUsed } });
      }
      return { ...current, storageUsed };
    }, { maxWait: 120_000, timeout: 120_000 });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    return NextResponse.json({
      ...user,
      storageUsed: Number(user.storageUsed),
      storageLimit: Number(user.storageLimit),
    });
  } catch (error) {
    console.error("Get user error:", error);
    return NextResponse.json(
      { error: "Failed to get user info" },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { viewPreference } = await request.json();

    if (viewPreference !== "grid" && viewPreference !== "list") {
      return NextResponse.json(
        { error: "Invalid view preference" },
        { status: 400 }
      );
    }

    const updated = await prisma.user.update({
      where: { id: session.user.id },
      data: { viewPreference },
    });

    return NextResponse.json({ viewPreference: updated.viewPreference });
  } catch (error) {
    console.error("Update user error:", error);
    return NextResponse.json(
      { error: "Failed to update user info" },
      { status: 500 }
    );
  }
}
