import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import mammoth from "mammoth";

// Convert HTML from mammoth into TipTap-compatible JSON
function htmlToTiptap(html: string): any {
  // Simple HTML → TipTap JSON converter
  const doc: any = { type: "doc", content: [] };

  // Split on block-level elements
  const blocks = html
    .replace(/<br\s*\/?>/gi, "\n")
    .split(/(?=<(?:p|h[1-6]|ul|ol|blockquote|pre|hr)[>\s])|(?<=<\/(?:p|h[1-6]|ul|ol|blockquote|pre)>)/gi)
    .filter((s) => s.trim());

  for (const block of blocks) {
    const trimmed = block.trim();
    if (!trimmed) continue;

    // Headings
    const headingMatch = trimmed.match(/^<h([1-3])[^>]*>([\s\S]*?)<\/h\1>/i);
    if (headingMatch) {
      doc.content.push({
        type: "heading",
        attrs: { level: parseInt(headingMatch[1]) },
        content: parseInlineContent(headingMatch[2]),
      });
      continue;
    }

    // Paragraphs
    const pMatch = trimmed.match(/^<p[^>]*>([\s\S]*?)<\/p>/i);
    if (pMatch) {
      doc.content.push({
        type: "paragraph",
        content: parseInlineContent(pMatch[1]),
      });
      continue;
    }

    // Lists
    const ulMatch = trimmed.match(/^<ul[^>]*>([\s\S]*?)<\/ul>/i);
    if (ulMatch) {
      doc.content.push(parseList(ulMatch[1], "bulletList"));
      continue;
    }
    const olMatch = trimmed.match(/^<ol[^>]*>([\s\S]*?)<\/ol>/i);
    if (olMatch) {
      doc.content.push(parseList(olMatch[1], "orderedList"));
      continue;
    }

    // Blockquote
    const bqMatch = trimmed.match(/^<blockquote[^>]*>([\s\S]*?)<\/blockquote>/i);
    if (bqMatch) {
      doc.content.push({
        type: "blockquote",
        content: [
          {
            type: "paragraph",
            content: parseInlineContent(bqMatch[1].replace(/<\/?p[^>]*>/gi, "")),
          },
        ],
      });
      continue;
    }

    // Code block
    const preMatch = trimmed.match(/^<pre[^>]*>([\s\S]*?)<\/pre>/i);
    if (preMatch) {
      const code = preMatch[1].replace(/<\/?code[^>]*>/gi, "").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
      doc.content.push({
        type: "codeBlock",
        content: [{ type: "text", text: code }],
      });
      continue;
    }

    // HR
    if (/^<hr/i.test(trimmed)) {
      doc.content.push({ type: "horizontalRule" });
      continue;
    }

    // Fallback: treat as paragraph with plain text
    const text = trimmed.replace(/<[^>]+>/g, "").trim();
    if (text) {
      doc.content.push({
        type: "paragraph",
        content: [{ type: "text", text }],
      });
    }
  }

  if (doc.content.length === 0) {
    doc.content.push({ type: "paragraph", content: [] });
  }

  return doc;
}

function parseInlineContent(html: string): any[] {
  if (!html || !html.trim()) return [];

  const content: any[] = [];
  // Very simple inline parser — handles bold, italic, underline, and plain text
  const stripped = html.replace(/&nbsp;/g, " ");

  // Use a regex to find styled spans and text
  const parts = stripped.split(/(<\/?(?:strong|b|em|i|u|s|code|sup|sub|a)[^>]*>)/gi);

  const markStack: string[] = [];
  let linkHref: string | null = null;

  for (const part of parts) {
    if (!part) continue;

    // Opening tags
    if (/^<(strong|b)\b/i.test(part)) { markStack.push("bold"); continue; }
    if (/^<(em|i)\b/i.test(part)) { markStack.push("italic"); continue; }
    if (/^<u\b/i.test(part)) { markStack.push("underline"); continue; }
    if (/^<s\b/i.test(part)) { markStack.push("strike"); continue; }
    if (/^<code\b/i.test(part)) { markStack.push("code"); continue; }
    if (/^<sup\b/i.test(part)) { markStack.push("superscript"); continue; }
    if (/^<sub\b/i.test(part)) { markStack.push("subscript"); continue; }
    const aMatch = part.match(/^<a[^>]+href="([^"]*)"[^>]*>/i);
    if (aMatch) { linkHref = aMatch[1]; markStack.push("link"); continue; }

    // Closing tags
    if (/^<\/(strong|b)\b/i.test(part)) { removeFromStack(markStack, "bold"); continue; }
    if (/^<\/(em|i)\b/i.test(part)) { removeFromStack(markStack, "italic"); continue; }
    if (/^<\/u\b/i.test(part)) { removeFromStack(markStack, "underline"); continue; }
    if (/^<\/s\b/i.test(part)) { removeFromStack(markStack, "strike"); continue; }
    if (/^<\/code\b/i.test(part)) { removeFromStack(markStack, "code"); continue; }
    if (/^<\/sup\b/i.test(part)) { removeFromStack(markStack, "superscript"); continue; }
    if (/^<\/sub\b/i.test(part)) { removeFromStack(markStack, "subscript"); continue; }
    if (/^<\/a\b/i.test(part)) { removeFromStack(markStack, "link"); linkHref = null; continue; }

    // Skip other tags
    if (/^</.test(part)) continue;

    // Text content
    const text = part.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
    if (!text) continue;

    const marks: any[] = [];
    for (const m of markStack) {
      if (m === "link" && linkHref) {
        marks.push({ type: "link", attrs: { href: linkHref } });
      } else {
        marks.push({ type: m });
      }
    }

    content.push({
      type: "text",
      text,
      ...(marks.length > 0 ? { marks } : {}),
    });
  }

  return content;
}

function removeFromStack(stack: string[], item: string) {
  const idx = stack.lastIndexOf(item);
  if (idx >= 0) stack.splice(idx, 1);
}

function parseList(html: string, listType: string): any {
  const items: any[] = [];
  const liMatches = html.match(/<li[^>]*>([\s\S]*?)<\/li>/gi) || [];

  for (const li of liMatches) {
    const inner = li.replace(/^<li[^>]*>/i, "").replace(/<\/li>$/i, "");
    items.push({
      type: "listItem",
      content: [
        {
          type: "paragraph",
          content: parseInlineContent(inner),
        },
      ],
    });
  }

  return {
    type: listType,
    content: items.length > 0 ? items : [{ type: "listItem", content: [{ type: "paragraph", content: [] }] }],
  };
}

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const name = file.name;
    const ext = name.split(".").pop()?.toLowerCase();

    let title = name.replace(/\.[^.]+$/, "");
    let content: any = null;

    if (ext === "docx") {
      const buffer = Buffer.from(await file.arrayBuffer());
      const result = await mammoth.convertToHtml({ buffer });
      content = htmlToTiptap(result.value);
    } else if (ext === "sdoc") {
      const text = await file.text();
      const parsed = JSON.parse(text);
      title = parsed.title || title;
      content = parsed.content || null;
    } else if (ext === "txt" || ext === "md") {
      const text = await file.text();
      content = {
        type: "doc",
        content: text.split("\n").map((line: string) => ({
          type: "paragraph",
          content: line ? [{ type: "text", text: line }] : [],
        })),
      };
    } else if (ext === "html" || ext === "htm") {
      const html = await file.text();
      content = htmlToTiptap(html);
    } else {
      return NextResponse.json(
        { error: `Unsupported format: .${ext}. Supported: .docx, .sdoc, .txt, .md, .html` },
        { status: 400 }
      );
    }

    const document = await prisma.document.create({
      data: {
        title,
        content,
        userId: session.user.id,
      },
    });

    return NextResponse.json({
      id: document.id,
      title: document.title,
    });
  } catch (error) {
    console.error("Document import error:", error);
    return NextResponse.json({ error: "Failed to import document" }, { status: 500 });
  }
}
