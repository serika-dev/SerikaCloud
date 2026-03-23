import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
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

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Auto-repair storageUsed if it's out of sync
    const actualUsed = await prisma.file.aggregate({
      where: { userId: session.user.id },
      _sum: { size: true },
    });
    const correctSum = actualUsed._sum.size || BigInt(0);

    let finalStorageUsed = user.storageUsed;
    if (user.storageUsed !== correctSum) {
      console.log(`Repairing storage for ${user.email}: ${user.storageUsed} -> ${correctSum}`);
      const updated = await prisma.user.update({
        where: { id: session.user.id },
        data: { storageUsed: correctSum },
      });
      finalStorageUsed = updated.storageUsed;
    }

    return NextResponse.json({
      ...user,
      storageUsed: Number(finalStorageUsed),
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
