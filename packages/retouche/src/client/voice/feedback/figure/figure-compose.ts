import { blobDataUrl } from "../../record/screens/blob-data-url";
import type { FigureArrow, FigurePlan, ShotSize } from "./figure-geometry";

export type FigureContext = Pick<
  OffscreenCanvasRenderingContext2D,
  | "beginPath"
  | "drawImage"
  | "fill"
  | "fillStyle"
  | "globalAlpha"
  | "lineCap"
  | "lineJoin"
  | "lineWidth"
  | "restore"
  | "roundRect"
  | "save"
  | "scale"
  | "stroke"
  | "strokeStyle"
  | "translate"
>;

export interface FigureDrawing {
  accent: string;
  image: CanvasImageSource;
  natural: ShotSize;
  plan: FigurePlan;
  shot: ShotSize;
}

const HALO = { color: "#ffffff", width: 3 } as const;
const ARROW_WIDTH = 1.4;
const OUTLINE_FILL_ALPHA = 0.08;

function drawArrow(
  context: FigureContext,
  options: { accent: string; arrow: FigureArrow; stroke: number }
): void {
  const { accent, arrow, stroke } = options;
  const paths = [new Path2D(arrow.shaft), new Path2D(arrow.head)];
  context.translate(arrow.x, arrow.y);
  context.scale(arrow.aimX, arrow.aimY);
  context.lineCap = "round";
  context.lineJoin = "round";
  const inks = [
    { color: HALO.color, width: stroke * HALO.width },
    { color: accent, width: stroke * ARROW_WIDTH },
  ];
  for (const ink of inks) {
    context.strokeStyle = ink.color;
    context.lineWidth = ink.width;
    for (const path of paths) {
      context.stroke(path);
    }
  }
}

export function drawFigure(
  context: FigureContext,
  { accent, image, natural, plan, shot }: FigureDrawing
): void {
  const { arrow, outline, stroke } = plan;
  context.drawImage(image, 0, 0);
  context.save();
  context.scale(natural.width / shot.width, natural.height / shot.height);
  context.beginPath();
  context.roundRect(
    outline.x,
    outline.y,
    outline.width,
    outline.height,
    outline.radius
  );
  context.fillStyle = accent;
  context.globalAlpha = OUTLINE_FILL_ALPHA;
  context.fill();
  context.globalAlpha = 1;
  context.strokeStyle = accent;
  context.lineWidth = stroke;
  context.stroke();
  if (arrow) {
    drawArrow(context, { accent, arrow, stroke });
  }
  context.restore();
}

export async function composeFigure(options: {
  accent: string;
  imageUrl: string;
  plan: FigurePlan;
  shot: ShotSize;
}): Promise<string | null> {
  try {
    const response = await fetch(options.imageUrl);
    const bitmap = await createImageBitmap(await response.blob());
    const natural = { height: bitmap.height, width: bitmap.width };
    const canvas = new OffscreenCanvas(natural.width, natural.height);
    const context = canvas.getContext("2d");
    if (!context) {
      return null;
    }
    drawFigure(context, { ...options, image: bitmap, natural });
    bitmap.close();
    return await blobDataUrl(await canvas.convertToBlob({ type: "image/png" }));
  } catch {
    return null;
  }
}
