import { NextResponse } from "next/server";
import { abortUpload, readUploadSession, requireUploadUser, uploadErrorResponse } from "@/lib/uploads";

export const runtime = "nodejs";

export async function DELETE(request: Request) {
  try {
    const userId = await requireUploadUser();
    const body = await request.json();
    await abortUpload(readUploadSession(body?.token, userId));
    return NextResponse.json({ success: true });
  } catch (error) { return uploadErrorResponse(error); }
}
