import { NextResponse } from "next/server";
import { nanoid } from "nanoid";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { fileId, expiresIn, password, maxDownloads } = await request.json();

    if (!fileId) {
      return NextResponse.json(
        { error: "File ID is required" },
        { status: 400 }
      );
    }

    // Verify file belongs to user
    const file = await prisma.file.findFirst({
      where: { id: fileId, userId: session.user.id },
    });

    if (!file) {
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }

    const baseUrl = new URL(request.url).origin;

    // Check if an active (non-expired) share link already exists for this file
    const existingLink = await prisma.shareLink.findFirst({
      where: {
        fileId,
        userId: session.user.id,
        OR: [
          { expiresAt: null },
          { expiresAt: { gt: new Date() } },
        ],
      },
      orderBy: { createdAt: "desc" },
    });

    if (existingLink) {
      const shareUrl = `${baseUrl}/share/${existingLink.shortId}/${encodeURIComponent(file.name)}`;
      return NextResponse.json(
        {
          id: existingLink.id,
          shortId: existingLink.shortId,
          url: shareUrl,
          expiresAt: existingLink.expiresAt,
          createdAt: existingLink.createdAt,
          hasPassword: !!existingLink.password,
          maxDownloads: existingLink.maxDownloads,
          downloadCount: existingLink.downloadCount,
          reused: true,
        },
        { status: 200 }
      );
    }

    // Calculate expiry
    let expiresAt: Date | null = null;
    if (expiresIn) {
      expiresAt = new Date(Date.now() + expiresIn * 1000);
    }

    const shortId = nanoid(12);

    const shareLink = await prisma.shareLink.create({
      data: {
        shortId,
        fileId,
        userId: session.user.id,
        expiresAt,
        password: password || null,
        maxDownloads: maxDownloads ? Number(maxDownloads) : null,
      },
    });

    const shareUrl = `${baseUrl}/share/${shortId}/${encodeURIComponent(file.name)}`;

    return NextResponse.json(
      {
        id: shareLink.id,
        shortId,
        url: shareUrl,
        expiresAt: shareLink.expiresAt,
        createdAt: shareLink.createdAt,
        hasPassword: !!shareLink.password,
        maxDownloads: shareLink.maxDownloads,
        downloadCount: shareLink.downloadCount,
        reused: false,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Create share link error:", error);
    return NextResponse.json(
      { error: "Failed to create share link" },
      { status: 500 }
    );
  }
}

export async function GET(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const shareLinks = await prisma.shareLink.findMany({
      where: { userId: session.user.id },
      include: {
        file: {
          select: { name: true, mimeType: true, size: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    const formattedLinks = shareLinks.map((link) => ({
      ...link,
      hasPassword: !!link.password,
      password: undefined,
      file: {
        ...link.file,
        size: link.file.size.toString(),
      },
    }));

    return NextResponse.json({ shareLinks: formattedLinks });
  } catch (error) {
    console.error("List share links error:", error);
    return NextResponse.json(
      { error: "Failed to list share links" },
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

    const { id, password, maxDownloads, expiresIn, removePassword } = await request.json();

    if (!id) {
      return NextResponse.json({ error: "Link ID is required" }, { status: 400 });
    }

    const link = await prisma.shareLink.findFirst({
      where: { id, userId: session.user.id },
    });

    if (!link) {
      return NextResponse.json({ error: "Share link not found" }, { status: 404 });
    }

    const updateData: any = {};
    if (password !== undefined) updateData.password = password;
    if (removePassword) updateData.password = null;
    if (maxDownloads !== undefined) updateData.maxDownloads = maxDownloads ? Number(maxDownloads) : null;
    if (expiresIn !== undefined) {
      updateData.expiresAt = expiresIn ? new Date(Date.now() + expiresIn * 1000) : null;
    }

    const updated = await prisma.shareLink.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({
      id: updated.id,
      expiresAt: updated.expiresAt,
      hasPassword: !!updated.password,
      maxDownloads: updated.maxDownloads,
      downloadCount: updated.downloadCount,
    });
  } catch (error) {
    console.error("Update share link error:", error);
    return NextResponse.json(
      { error: "Failed to update share link" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const linkId = searchParams.get("id");

    if (!linkId) {
      return NextResponse.json({ error: "Link ID is required" }, { status: 400 });
    }

    const link = await prisma.shareLink.findFirst({
      where: { id: linkId, userId: session.user.id },
    });

    if (!link) {
      return NextResponse.json({ error: "Share link not found" }, { status: 404 });
    }

    await prisma.shareLink.delete({ where: { id: linkId } });

    return NextResponse.json({ message: "Share link removed" });
  } catch (error) {
    console.error("Delete share link error:", error);
    return NextResponse.json(
      { error: "Failed to delete share link" },
      { status: 500 }
    );
  }
}
