import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getFileFromB2, deleteFileFromB2 } from "@/lib/storage";

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string; filename: string[] }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await ctx.params;

    const file = await prisma.file.findFirst({
      where: { id, userId: session.user.id },
    });

    if (!file) {
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }

    const range = _req.headers.get("range") || undefined;
    const b2Response = await getFileFromB2(file.b2Key, range);

    if (!b2Response.body) {
      return NextResponse.json({ error: "File data not available" }, { status: 500 });
    }

    const stream = b2Response.body as ReadableStream;

    const headers: Record<string, string> = {
      "Content-Type": b2Response.contentType || file.mimeType,
      "Content-Length": String(b2Response.contentLength),
      "Content-Disposition": `inline; filename="${encodeURIComponent(file.name)}"`,
      "Cache-Control": "private, max-age=3600",
      "Accept-Ranges": "bytes",
    };

    if (b2Response.contentRange) {
      headers["Content-Range"] = b2Response.contentRange;
    }

    return new Response(stream as unknown as BodyInit, {
      status: range ? 206 : 200,
      headers,
    });
  } catch (error: any) {
    if (error.name === "InvalidRange" || error.$metadata?.httpStatusCode === 416) {
      return new Response(null, { status: 416 });
    }
    console.error("Get file error:", error);
    return NextResponse.json(
      { error: "Failed to retrieve file" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string; filename: string[] }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await ctx.params;

    const file = await prisma.file.findFirst({
      where: { id, userId: session.user.id },
    });

    if (!file) {
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }

    // Delete from B2
    await deleteFileFromB2(file.b2Key);

    // Delete from DB
    await prisma.file.delete({ where: { id } });

    // Update storage used
    await prisma.user.update({
      where: { id: session.user.id },
      data: {
        storageUsed: {
          decrement: file.size,
        },
      },
    });

    return NextResponse.json({ message: "File deleted successfully" });
  } catch (error) {
    console.error("Delete file error:", error);
    return NextResponse.json(
      { error: "Failed to delete file" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ id: string; filename: string[] }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await ctx.params;
    const body = await req.json();
    const { name, folderId } = body;

    if (name !== undefined && typeof name !== "string") {
      return NextResponse.json({ error: "Invalid name" }, { status: 400 });
    }
    if (folderId !== undefined && typeof folderId !== "string" && folderId !== null) {
      return NextResponse.json({ error: "Invalid folderId" }, { status: 400 });
    }

    const file = await prisma.file.findFirst({
      where: { id, userId: session.user.id },
    });

    if (!file) {
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }

    const updateData: any = {};
    if (name !== undefined) updateData.name = name;
    if (folderId !== undefined) {
      if (folderId === null) {
        updateData.folderId = null;
      } else {
        const destFolder = await prisma.folder.findFirst({
          where: { id: folderId as string, userId: session.user.id },
        });
        if (!destFolder) return NextResponse.json({ error: "Destination folder not found" }, { status: 404 });
        updateData.folderId = folderId;
      }
    }

    const updated = await prisma.file.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({
      id: updated.id,
      name: updated.name,
      mimeType: updated.mimeType,
      size: Number(updated.size),
    });
  } catch (error) {
    console.error("Update file error:", error);
    return NextResponse.json(
      { error: "Failed to update file" },
      { status: 500 }
    );
  }
}
