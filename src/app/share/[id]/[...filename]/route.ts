import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { getFileFromB2 } from "@/lib/storage";

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string; filename: string[] }> }
) {
  try {
    const { id } = await ctx.params;

    // Find hte share link and file
    const shareLink = await prisma.shareLink.findUnique({
      where: { shortId: id },
      include: { file: true },
    });

    if (!shareLink || !shareLink.file) {
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }

    const file = shareLink.file;

    // Optional: Check expiration or limits here if implemented

    const range = _req.headers.get("range") || undefined;
    const storageResponse = await getFileFromB2(file.b2Key, range);

    if (!storageResponse.body) {
      return NextResponse.json({ error: "File data not available" }, { status: 500 });
    }

    const stream = storageResponse.body as ReadableStream;

    const headers: Record<string, string> = {
      "Content-Type": storageResponse.contentType || file.mimeType,
      "Content-Length": String(storageResponse.contentLength),
      "Content-Disposition": `inline; filename="${encodeURIComponent(file.name)}"`,
      "Cache-Control": "public, max-age=3600",
      "Accept-Ranges": "bytes",
    };

    if (storageResponse.contentRange) {
      headers["Content-Range"] = storageResponse.contentRange;
    }

    return new Response(stream as unknown as BodyInit, {
      status: range ? 206 : 200,
      headers,
    });
  } catch (error: any) {
    if (error.name === "InvalidRange" || error.$metadata?.httpStatusCode === 416) {
      return new Response(null, { status: 416 });
    }
    console.error("Shared download error:", error);
    return NextResponse.json(
      { error: "Failed to retrieve shared file" },
      { status: 500 }
    );
  }
}
