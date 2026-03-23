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

    if (!folderId) {
      return NextResponse.json({ breadcrumbs: [] });
    }

    const breadcrumbs: { id: string; name: string }[] = [];
    let currentId: string | null = folderId;

    while (currentId) {
      const folder: { id: string; name: string; parentId: string | null } | null = await prisma.folder.findFirst({
        where: { id: currentId, userId: session.user.id },
        select: { id: true, name: true, parentId: true },
      });

      if (!folder) break;

      breadcrumbs.unshift({ id: folder.id, name: folder.name });
      currentId = folder.parentId;
    }

    return NextResponse.json({ breadcrumbs });
  } catch (error) {
    console.error("Breadcrumbs error:", error);
    return NextResponse.json({ breadcrumbs: [] });
  }
}
