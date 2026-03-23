import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get("token");

    if (!token) {
      return NextResponse.redirect(new URL("/login?error=invalid-token", request.url));
    }

    const user = await prisma.user.findUnique({
      where: { verificationToken: token },
    });

    if (!user) {
      return NextResponse.redirect(new URL("/login?error=invalid-token", request.url));
    }

    await prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerified: true,
        verificationToken: null,
      },
    });

    return NextResponse.redirect(new URL("/login?verified=true", request.url));
  } catch (error) {
    console.error("Verification error:", error);
    return NextResponse.redirect(new URL("/login?error=verification-failed", request.url));
  }
}
