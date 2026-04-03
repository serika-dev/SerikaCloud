import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// Webhook endpoint for receiving emails from an external MTA (e.g., Postal, Maddy)
// The MTA should POST to this endpoint with the parsed email data
// Supports: personal mailboxes, aliases, AND group mailboxes (org addresses)
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
    const resolvedFrom = typeof from === "string" ? from : from?.address || "unknown";
    const resolvedFromName = fromName || (typeof from === "object" ? from?.name : null);
    const resolvedTo = to.map((t: any) => (typeof t === "string" ? t : t.address));
    const resolvedCc = cc?.map((c: any) => (typeof c === "string" ? c : c.address)) || [];

    for (const recipient of to) {
      const address = (typeof recipient === "string" ? recipient : recipient.address).toLowerCase();

      // 1. Check personal mailbox
      let mailbox = await prisma.mailbox.findUnique({
        where: { address },
        include: { folders: true },
      });

      if (!mailbox) {
        // Check personal aliases
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

      if (mailbox) {
        const inboxFolder = mailbox.folders.find((f) => f.type === "inbox");
        if (inboxFolder) {
          await prisma.email.create({
            data: {
              messageId: messageId || null,
              fromAddress: resolvedFrom,
              fromName: resolvedFromName,
              toAddresses: resolvedTo,
              ccAddresses: resolvedCc,
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
        continue;
      }

      // 2. Check group mailboxes (org addresses like support@acme.com)
      const groupMailbox = await prisma.groupMailbox.findUnique({
        where: { address },
        include: { folders: true },
      });

      if (groupMailbox) {
        const inboxFolder = groupMailbox.folders.find((f: any) => f.type === "inbox");
        if (inboxFolder) {
          await prisma.groupEmail.create({
            data: {
              messageId: messageId ? `${messageId}-group-${groupMailbox.id}` : null,
              fromAddress: resolvedFrom,
              fromName: resolvedFromName,
              toAddresses: resolvedTo,
              ccAddresses: resolvedCc,
              subject: subject || "(No Subject)",
              bodyText: text || null,
              bodyHtml: html || null,
              groupMailboxId: groupMailbox.id,
              folderId: inboxFolder.id,
              inReplyTo: inReplyTo || null,
              references: references || null,
              headers: headers || null,
            },
          });
          delivered++;

          // Send auto-reply if configured
          if (groupMailbox.autoReply && resolvedFrom !== address) {
            // Auto-reply is handled asynchronously — fire and forget
            sendAutoReply(groupMailbox.address, groupMailbox.displayName, resolvedFrom, groupMailbox.autoReply, subject).catch(() => {});
          }
        }
        continue;
      }

      // 3. Check if the domain belongs to an org — catch-all for verified org domains
      const domain = address.split("@")[1];
      if (domain) {
        const orgDomain = await prisma.orgDomain.findUnique({
          where: { domain },
          include: { org: true },
        });

        if (orgDomain && (orgDomain.status === "ACTIVE" || orgDomain.status === "VERIFIED")) {
          // Find a catch-all group mailbox for this org (one without a group — org-wide)
          const catchAll = await prisma.groupMailbox.findFirst({
            where: { orgId: orgDomain.orgId, groupId: null },
            include: { folders: true },
          });

          if (catchAll) {
            const inboxFolder = catchAll.folders.find((f: any) => f.type === "inbox");
            if (inboxFolder) {
              await prisma.groupEmail.create({
                data: {
                  messageId: messageId ? `${messageId}-catchall-${catchAll.id}` : null,
                  fromAddress: resolvedFrom,
                  fromName: resolvedFromName,
                  toAddresses: resolvedTo,
                  ccAddresses: resolvedCc,
                  subject: subject || "(No Subject)",
                  bodyText: text || null,
                  bodyHtml: html || null,
                  groupMailboxId: catchAll.id,
                  folderId: inboxFolder.id,
                  inReplyTo: inReplyTo || null,
                  references: references || null,
                  headers: headers || null,
                },
              });
              delivered++;
            }
          }
        }
      }
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

// Fire-and-forget auto-reply for group mailboxes
async function sendAutoReply(
  fromAddress: string,
  fromName: string | null,
  toAddress: string,
  autoReplyText: string,
  originalSubject: string | null
) {
  try {
    const { SESv2Client, SendEmailCommand } = await import("@aws-sdk/client-sesv2");
    const ses = new SESv2Client({
      region: process.env.AWS_SES_REGION || "eu-west-1",
      credentials: {
        accessKeyId: process.env.AWS_SES_ACCESS_KEY_ID || process.env.AWS_ACCESS_KEY_ID || "",
        secretAccessKey: process.env.AWS_SES_SECRET_ACCESS_KEY || process.env.AWS_SECRET_ACCESS_KEY || "",
      },
    });

    await ses.send(new SendEmailCommand({
      FromEmailAddress: fromName ? `"${fromName}" <${fromAddress}>` : fromAddress,
      Destination: { ToAddresses: [toAddress] },
      Content: {
        Simple: {
          Subject: { Data: `Re: ${originalSubject || "(No Subject)"}`, Charset: "UTF-8" },
          Body: { Text: { Data: autoReplyText, Charset: "UTF-8" } },
        },
      },
    }));
  } catch (error) {
    console.error("Auto-reply failed:", error);
  }
}
