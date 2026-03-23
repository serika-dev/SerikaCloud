import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import PptxGenJS from "pptxgenjs";

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
  const format = searchParams.get("format") || "sppt";

  const presentation = await prisma.presentation.findFirst({
    where: { id, userId: session.user.id },
    include: { slides: { orderBy: { order: "asc" } } },
  });

  if (!presentation) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (format === "sppt") {
    const data = JSON.stringify(
      {
        title: presentation.title,
        theme: presentation.theme,
        slides: presentation.slides.map((s) => ({
          order: s.order,
          content: s.content,
          notes: s.notes,
          layout: s.layout,
          background: s.background,
        })),
        exportedAt: new Date().toISOString(),
        format: "sppt",
        version: 1,
      },
      null,
      2
    );

    return new NextResponse(data, {
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="${encodeURIComponent(presentation.title)}.sppt"`,
      },
    });
  }

  if (format === "pptx") {
    const pptx = new PptxGenJS();
    pptx.title = presentation.title;
    pptx.layout = "LAYOUT_WIDE";

    for (const slide of presentation.slides) {
      const pptxSlide = pptx.addSlide();

      if (slide.background) {
        pptxSlide.background = { fill: slide.background.replace("#", "") };
      }

      const elements = (slide.content as any)?.elements || [];

      for (const el of elements) {
        const x = (el.x / 100) * 13.33;
        const y = (el.y / 100) * 7.5;
        const w = (el.width / 100) * 13.33;
        const h = (el.height / 100) * 7.5;

        if (el.type === "text") {
          pptxSlide.addText(el.content || "", {
            x,
            y,
            w,
            h,
            fontSize: el.fontSize || 24,
            fontFace: el.fontFamily?.split(",")[0]?.trim() || "Arial",
            bold: el.fontWeight === "bold",
            color: (el.color || "#ffffff").replace("#", ""),
            align:
              el.textAlign === "center"
                ? "center"
                : el.textAlign === "right"
                  ? "right"
                  : "left",
            valign: "middle",
            wrap: true,
          });
        } else if (el.type === "image" && el.src) {
          try {
            pptxSlide.addImage({ path: el.src, x, y, w, h });
          } catch {
            // Skip images that can't be loaded
          }
        } else if (el.type === "shape") {
          const isCircle = el.borderRadius && el.borderRadius >= 999;
          pptxSlide.addShape(isCircle ? "ellipse" : "rect", {
            x,
            y,
            w,
            h,
            fill: {
              color: (el.backgroundColor || "#7c3aed").replace("#", ""),
            },
            rectRadius:
              !isCircle && el.borderRadius ? el.borderRadius / 100 : undefined,
          } as any);
        }
      }

      if (slide.notes) {
        pptxSlide.addNotes(slide.notes);
      }
    }

    const uint8 = (await pptx.write({
      outputType: "uint8array",
    })) as Uint8Array;
    const buffer = Buffer.from(uint8);

    return new NextResponse(buffer, {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        "Content-Disposition": `attachment; filename="${encodeURIComponent(presentation.title)}.pptx"`,
      },
    });
  }

  return NextResponse.json(
    { error: `Unsupported format: ${format}` },
    { status: 400 }
  );
}
