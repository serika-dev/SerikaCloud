import { NextResponse } from "next/server";
import { readUploadSession, receiveUploadPart, requireUploadUser, uploadErrorResponse } from "@/lib/uploads";

export const runtime = "nodejs";

export async function PUT(request: Request) {
  try {
    const userId = await requireUploadUser();
    const session = readUploadSession(request.headers.get("x-upload-token"), userId);
    const part = await receiveUploadPart(request, session, Number(request.headers.get("x-part-number")));
    return NextResponse.json(part);
  } catch (error) { return uploadErrorResponse(error); }
}
