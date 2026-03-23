import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const parentId = searchParams.get("parentId");

    const folders = await prisma.folder.findMany({
      where: {
        userId: session.user.id,
        parentId: parentId || null,
      },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        parentId: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: {
            files: true,
            children: true,
          },
        },
      },
    });

    return NextResponse.json({ folders });
  } catch (error) {
    console.error("List folders error:", error);
    return NextResponse.json(
      { error: "Failed to list folders" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { name, parentId } = await request.json();

    if (!name || typeof name !== "string") {
      return NextResponse.json(
        { error: "Folder name is required" },
        { status: 400 }
      );
    }

    // Validate parent folder exists and belongs to user
    if (parentId) {
      const parentFolder = await prisma.folder.findFirst({
        where: { id: parentId, userId: session.user.id },
      });
      if (!parentFolder) {
        return NextResponse.json(
          { error: "Parent folder not found" },
          { status: 404 }
        );
      }
    }

    const folder = await prisma.folder.create({
      data: {
        name,
        parentId: parentId || null,
        userId: session.user.id,
      },
    });

    return NextResponse.json(folder, { status: 201 });
  } catch (error) {
    console.error("Create folder error:", error);
    return NextResponse.json(
      { error: "Failed to create folder" },
      { status: 500 }
    );
  }
}
