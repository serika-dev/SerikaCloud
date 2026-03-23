import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { SESv2Client, SendEmailCommand } from "@aws-sdk/client-sesv2";
import { nanoid } from "nanoid";

const ses = new SESv2Client({
  region: process.env.AWS_SES_REGION || "eu-west-1",
  credentials: {
    accessKeyId: process.env.AWS_SES_ACCESS_KEY_ID || process.env.AWS_ACCESS_KEY_ID || "",
    secretAccessKey: process.env.AWS_SES_SECRET_ACCESS_KEY || process.env.AWS_SECRET_ACCESS_KEY || "",
  },
});

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { to, cc, bcc, subject, bodyHtml, bodyText, inReplyTo, fromAddress } = body;

  if (!to || !Array.isArray(to) || to.length === 0) {
    return NextResponse.json({ error: "Recipients required" }, { status: 400 });
  }

  const mailbox = await prisma.mailbox.findFirst({
    where: { userId: session.user.id, isPrimary: true },
    include: { folders: true, aliases: true },
  });

  if (!mailbox) {
    return NextResponse.json(
      { error: "No mailbox configured. Please set up your email address first." },
      { status: 400 }
    );
  }

  const sentFolder = mailbox.folders.find((f) => f.type === "sent");
  if (!sentFolder) {
    return NextResponse.json({ error: "Sent folder not found" }, { status: 500 });
  }

  // Resolve sender: allow primary address or any alias, default to primary
  const validAddresses = [mailbox.address, ...mailbox.aliases.map((a) => a.address)];
  const senderAddress =
    fromAddress && validAddresses.includes(fromAddress.toLowerCase())
      ? fromAddress.toLowerCase()
      : mailbox.address;

  const userName = session.user.name || senderAddress.split("@")[0];
  const messageId = `<${nanoid()}@serika.pro>`;

  try {
    const command = new SendEmailCommand({
      FromEmailAddress: `"${userName}" <${senderAddress}>`,
      Destination: {
        ToAddresses: to,
        CcAddresses: cc?.length ? cc : undefined,
        BccAddresses: bcc?.length ? bcc : undefined,
      },
      Content: {
        Simple: {
          Subject: { Data: subject || "(No Subject)", Charset: "UTF-8" },
          Body: {
            ...(bodyHtml
              ? { Html: { Data: bodyHtml, Charset: "UTF-8" } }
              : {}),
            ...(bodyText
              ? { Text: { Data: bodyText, Charset: "UTF-8" } }
              : {}),
          },
          Headers: inReplyTo
            ? [{ Name: "In-Reply-To", Value: inReplyTo }]
            : undefined,
        },
      },
    });

    const result = await ses.send(command);

    // Save to sent folder
    const email = await prisma.email.create({
      data: {
        messageId: result.MessageId || messageId,
        fromAddress: mailbox.address,
        fromName: userName,
        toAddresses: to,
        ccAddresses: cc || [],
        bccAddresses: bcc || [],
        subject: subject || "(No Subject)",
        bodyText: bodyText || "",
        bodyHtml: bodyHtml || "",
        mailboxId: mailbox.id,
        folderId: sentFolder.id,
        isRead: true,
        inReplyTo: inReplyTo || null,
      },
    });

    return NextResponse.json({
      success: true,
      emailId: email.id,
      messageId: result.MessageId,
    });
  } catch (error: any) {
    console.error("Failed to send email via SES:", error);
    return NextResponse.json(
      { error: "Failed to send email", details: error.message },
      { status: 500 }
    );
  }
}
