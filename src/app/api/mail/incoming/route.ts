import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// Webhook endpoint for receiving emails from an external MTA (e.g., Postal, Maddy)
// The MTA should POST to this endpoint with the parsed email data
export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const webhookSecret = process.env.MAIL_WEBHOOK_SECRET;

  if (webhookSecret && authHeader !== `Bearer ${webhookSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const {
      from,
      fromName,
      to,
      cc,
      subject,
      text,
      html,
      messageId,
      inReplyTo,
      references,
      headers,
    } = body;

    if (!to || !Array.isArray(to)) {
      return NextResponse.json({ error: "Invalid recipients" }, { status: 400 });
    }

    let delivered = 0;

    for (const recipient of to) {
      const address = typeof recipient === "string" ? recipient : recipient.address;

      // Find mailbox by primary address or alias
      let mailbox = await prisma.mailbox.findUnique({
        where: { address },
        include: { folders: true },
      });

      if (!mailbox) {
        // Check aliases
        const alias = await prisma.emailAlias.findUnique({
          where: { address },
          include: {
            mailbox: {
              include: { folders: true },
            },
          },
        });
        if (alias) {
          mailbox = alias.mailbox;
        }
      }

      if (!mailbox) continue;

      const inboxFolder = mailbox.folders.find((f) => f.type === "inbox");
      if (!inboxFolder) continue;

      await prisma.email.create({
        data: {
          messageId: messageId || null,
          fromAddress: typeof from === "string" ? from : from?.address || "unknown",
          fromName: fromName || (typeof from === "object" ? from?.name : null),
          toAddresses: to.map((t: any) => (typeof t === "string" ? t : t.address)),
          ccAddresses: cc?.map((c: any) => (typeof c === "string" ? c : c.address)) || [],
          subject: subject || "(No Subject)",
          bodyText: text || null,
          bodyHtml: html || null,
          mailboxId: mailbox.id,
          folderId: inboxFolder.id,
          inReplyTo: inReplyTo || null,
          references: references || null,
          headers: headers || null,
        },
      });

      delivered++;
    }

    return NextResponse.json({ success: true, delivered });
  } catch (error: any) {
    console.error("Failed to process incoming email:", error);
    return NextResponse.json(
      { error: "Failed to process email", details: error.message },
      { status: 500 }
    );
  }
}
