import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { deleteFileFromB2 } from "@/lib/storage";

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
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

  const { id } = await params;

  // Prevent self-deletion
  if (id === session.user.id) {
    return NextResponse.json(
      { error: "Cannot delete your own account" },
      { status: 400 }
    );
  }

  const user = await prisma.user.findUnique({
    where: { id },
    include: {
      files: { select: { b2Key: true } },
    },
  });

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  // Delete user's files from storage
  for (const file of user.files) {
    try {
      await deleteFileFromB2(file.b2Key);
    } catch (err) {
      console.error(`Failed to delete file ${file.b2Key}:`, err);
      // Continue deleting other files
    }
  }

  // Delete user (cascades to all related data via Prisma relations)
  await prisma.user.delete({
    where: { id },
  });

  return NextResponse.json({
    success: true,
    message: `User ${user.email} and all associated data have been deleted.`,
  });
}
