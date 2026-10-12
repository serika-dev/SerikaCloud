import { NextResponse } from "next/server";
import { completeUpload, readUploadSession, requireUploadUser, uploadErrorResponse } from "@/lib/uploads";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const userId = await requireUploadUser();
    const body = await request.json();
    return NextResponse.json(await completeUpload(readUploadSession(body?.token, userId)), { status: 201 });
  } catch (error) { return uploadErrorResponse(error); }
}
