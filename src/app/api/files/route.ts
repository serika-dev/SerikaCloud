import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const folderId = searchParams.get("folderId");
    const search = searchParams.get("search");
    const recent = searchParams.get("recent") === "true";

    // Build query
    const whereClause: Record<string, unknown> = {
      userId: session.user.id,
    };

    if (search) {
      whereClause.name = { contains: search };
    } else if (!recent) {
      whereClause.folderId = folderId || null;
    }

    const [files, folders] = await Promise.all([
      prisma.file.findMany({
        where: whereClause,
        orderBy: { createdAt: "desc" },
        take: recent ? 50 : undefined,
        select: {
          id: true,
          name: true,
          mimeType: true,
          size: true,
          createdAt: true,
          updatedAt: true,
          folderId: true,
        },
      }),
      search || recent
        ? []
        : prisma.folder.findMany({
            where: {
              userId: session.user.id,
              parentId: folderId || null,
            },
            orderBy: { name: "asc" },
            select: {
              id: true,
              name: true,
              createdAt: true,
              updatedAt: true,
              parentId: true,
              _count: {
                select: {
                  files: true,
                  children: true,
                },
              },
            },
          }),
    ]);

    // Convert BigInt to number for JSON serialization
    const serializedFiles = files.map((f) => ({
      ...f,
      size: Number(f.size),
    }));

    return NextResponse.json({
      files: serializedFiles,
      folders,
    });
  } catch (error) {
    console.error("List files error:", error);
    return NextResponse.json(
      { error: "Failed to list files" },
      { status: 500 }
    );
  }
}
