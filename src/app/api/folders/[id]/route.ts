import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { deleteFileFromB2 } from "@/lib/storage";

export async function DELETE(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await ctx.params;

    // Recursive function to get all files in a folder and its children
    async function getDeepFiles(folderId: string): Promise<any[]> {
      const folder = await prisma.folder.findUnique({
        where: { id: folderId },
        include: {
          files: true,
          children: {
            select: { id: true },
          },
        },
      });

      if (!folder) return [];

      let files = [...folder.files];
      for (const child of folder.children) {
        const childFiles = await getDeepFiles(child.id);
        files = files.concat(childFiles);
      }
      return files;
    }

    const allFiles = await getDeepFiles(id);

    if (allFiles.length === 0) {
      // If no files, just check if the folder exists and delete it
      const folder = await prisma.folder.findFirst({
        where: { id, userId: session.user.id },
      });
      if (!folder) {
        return NextResponse.json({ error: "Folder not found" }, { status: 404 });
      }
    }

    // Delete all files from B2
    let totalSizeFreed = BigInt(0);
    for (const file of allFiles) {
      try {
        await deleteFileFromB2(file.b2Key);
        totalSizeFreed += file.size;
      } catch (e) {
        console.error(`Failed to delete B2 file ${file.b2Key}:`, e);
      }
    }

    // Delete the top-level folder (cascades in DB)
    await prisma.folder.delete({
      where: { id, userId: session.user.id },
    });

    // Update storage
    if (totalSizeFreed > 0) {
      await prisma.user.update({
        where: { id: session.user.id },
        data: {
          storageUsed: {
            decrement: totalSizeFreed,
          },
        },
      });
    }

    return NextResponse.json({ message: "Folder and contents deleted successfully" });
  } catch (error) {
    console.error("Delete folder error:", error);
    return NextResponse.json(
      { error: "Failed to delete folder" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await ctx.params;
    const { name, parentId } = await req.json();

    if (name !== undefined && typeof name !== "string") {
      return NextResponse.json(
        { error: "Folder name must be a string" },
        { status: 400 }
      );
    }
    if (parentId !== undefined && typeof parentId !== "string" && parentId !== null) {
      return NextResponse.json({ error: "Invalid parentId" }, { status: 400 });
    }

    const folder = await prisma.folder.findFirst({
      where: { id, userId: session.user.id },
    });

    if (!folder) {
      return NextResponse.json({ error: "Folder not found" }, { status: 404 });
    }

    // Prevent recursive loop (a folder moving into itself)
    if (parentId === id) {
      return NextResponse.json({ error: "Cannot move folder into itself" }, { status: 400 });
    }

    const updateData: any = {};
    if (name !== undefined) updateData.name = name;
    if (parentId !== undefined) {
      if (parentId === null) {
        updateData.parentId = null;
      } else {
        const destFolder = await prisma.folder.findFirst({
          where: { id: parentId as string, userId: session.user.id },
        });
        if (!destFolder) return NextResponse.json({ error: "Destination folder not found" }, { status: 404 });
        updateData.parentId = parentId;
      }
    }

    const updated = await prisma.folder.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Update folder error:", error);
    return NextResponse.json(
      { error: "Failed to update folder" },
      { status: 500 }
    );
  }
}
