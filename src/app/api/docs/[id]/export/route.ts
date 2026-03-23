import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  Document as DocxDocument,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
} from "docx";

function tiptapToDocxParagraphs(node: any): Paragraph[] {
  const paragraphs: Paragraph[] = [];

  if (!node || !node.content) return paragraphs;

  for (const block of node.content) {
    if (block.type === "heading") {
      const level = block.attrs?.level || 1;
      const headingLevel =
        level === 1
          ? HeadingLevel.HEADING_1
          : level === 2
            ? HeadingLevel.HEADING_2
            : HeadingLevel.HEADING_3;

      const runs = extractTextRuns(block);
      paragraphs.push(
        new Paragraph({
          children: runs,
          heading: headingLevel,
          alignment: mapAlignment(block.attrs?.textAlign),
        })
      );
    } else if (block.type === "paragraph") {
      const runs = extractTextRuns(block);
      paragraphs.push(
        new Paragraph({
          children: runs,
          alignment: mapAlignment(block.attrs?.textAlign),
        })
      );
    } else if (block.type === "bulletList" || block.type === "orderedList") {
      const items = block.content || [];
      for (const item of items) {
        if (item.type === "listItem" && item.content) {
          for (const p of item.content) {
            const runs = extractTextRuns(p);
            paragraphs.push(
              new Paragraph({
                children: runs,
                bullet: block.type === "bulletList" ? { level: 0 } : undefined,
                numbering:
                  block.type === "orderedList"
                    ? { reference: "default-numbering", level: 0 }
                    : undefined,
              })
            );
          }
        }
      }
    } else if (block.type === "blockquote" && block.content) {
      for (const child of block.content) {
        const runs = extractTextRuns(child);
        paragraphs.push(
          new Paragraph({
            children: runs,
            indent: { left: 720 },
          })
        );
      }
    } else if (block.type === "codeBlock") {
      const text = block.content?.map((c: any) => c.text || "").join("") || "";
      paragraphs.push(
        new Paragraph({
          children: [
            new TextRun({
              text,
              font: "Courier New",
              size: 20,
            }),
          ],
        })
      );
    } else if (block.type === "horizontalRule") {
      paragraphs.push(new Paragraph({ children: [], border: { bottom: { style: "single" as any, size: 6, color: "999999" } } }));
    }
  }

  return paragraphs;
}

function extractTextRuns(block: any): TextRun[] {
  if (!block?.content) return [new TextRun("")];

  return block.content.map((inline: any) => {
    if (inline.type === "text") {
      const marks = inline.marks || [];
      const opts: any = { text: inline.text || "" };

      for (const mark of marks) {
        if (mark.type === "bold") opts.bold = true;
        if (mark.type === "italic") opts.italics = true;
        if (mark.type === "underline") opts.underline = {};
        if (mark.type === "strike") opts.strike = true;
        if (mark.type === "code") opts.font = "Courier New";
        if (mark.type === "superscript") opts.superScript = true;
        if (mark.type === "subscript") opts.subScript = true;
        if (mark.type === "textStyle") {
          if (mark.attrs?.color) opts.color = mark.attrs.color.replace("#", "");
          if (mark.attrs?.fontSize) {
            const px = parseInt(mark.attrs.fontSize);
            if (px) opts.size = px * 1.5; // rough px to half-point
          }
          if (mark.attrs?.fontFamily) opts.font = mark.attrs.fontFamily.split(",")[0].trim();
        }
        if (mark.type === "highlight" && mark.attrs?.color) {
          opts.highlight = mark.attrs.color;
        }
      }

      return new TextRun(opts);
    }
    return new TextRun("");
  });
}

function mapAlignment(align?: string): (typeof AlignmentType)[keyof typeof AlignmentType] | undefined {
  if (!align) return undefined;
  switch (align) {
    case "left": return AlignmentType.LEFT;
    case "center": return AlignmentType.CENTER;
    case "right": return AlignmentType.RIGHT;
    case "justify": return AlignmentType.JUSTIFIED;
    default: return undefined;
  }
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const { searchParams } = new URL(req.url);
  const format = searchParams.get("format") || "sdoc";

  const document = await prisma.document.findFirst({
    where: { id, userId: session.user.id },
  });

  if (!document) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (format === "sdoc") {
    // Native JSON format
    const data = JSON.stringify({
      title: document.title,
      content: document.content,
      exportedAt: new Date().toISOString(),
      format: "sdoc",
      version: 1,
    }, null, 2);

    return new NextResponse(data, {
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="${encodeURIComponent(document.title)}.sdoc"`,
      },
    });
  }

  if (format === "docx") {
    const paragraphs = tiptapToDocxParagraphs(document.content as any);

    const doc = new DocxDocument({
      sections: [
        {
          children: paragraphs.length > 0 ? paragraphs : [new Paragraph("")],
        },
      ],
    });

    const buffer = await Packer.toBuffer(doc);

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename="${encodeURIComponent(document.title)}.docx"`,
      },
    });
  }

  return NextResponse.json({ error: `Unsupported format: ${format}` }, { status: 400 });
}
