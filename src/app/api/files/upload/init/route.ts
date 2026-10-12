import { NextResponse } from "next/server";
import { initiateUpload, parseUploadMetadata, requireUploadUser, uploadErrorResponse } from "@/lib/uploads";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const userId = await requireUploadUser();
    const metadata = parseUploadMetadata(await request.json());
    return NextResponse.json(await initiateUpload(userId, metadata), { status: 201 });
  } catch (error) { return uploadErrorResponse(error); }
}
