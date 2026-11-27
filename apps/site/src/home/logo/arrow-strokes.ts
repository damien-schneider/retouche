interface Point {
  x: number;
  y: number;
}

export interface ArrowStrokes {
  head: string;
  shaft: string;
}

const TAIL: Point = { x: 4, y: 4 };
const TIP: Point = { x: 57.5, y: 58 };
const BOW: Point = { x: 26, y: 17 };
const ARMS: readonly Point[] = [
  { x: 59, y: 35 },
  { x: 35.5, y: 56.5 },
];
const REST_HEADING = Math.atan2(TIP.y - BOW.y, TIP.x - BOW.x);

function at({ x, y }: Point): string {
  return `${x.toFixed(2)} ${y.toFixed(2)}`;
}

function around(
  point: Point,
  { length, turn }: { length: number; turn: number }
): Point {
  const dx = (point.x - TIP.x) * length;
  const dy = (point.y - TIP.y) * length;
  return {
    x: TIP.x + dx * Math.cos(turn) - dy * Math.sin(turn),
    y: TIP.y + dx * Math.sin(turn) + dy * Math.cos(turn),
  };
}

export function arrowStrokes(bend: number, stretch: number): ArrowStrokes {
  const tail = around(TAIL, { length: stretch, turn: 0 });
  const middle = { x: (tail.x + TIP.x) / 2, y: (tail.y + TIP.y) / 2 };
  const bow = around(BOW, { length: stretch, turn: 0 });
  const control = {
    x: middle.x + (bow.x - middle.x) * bend,
    y: middle.y + (bow.y - middle.y) * bend,
  };
  const turn = Math.atan2(TIP.y - control.y, TIP.x - control.x) - REST_HEADING;
  const [left = TIP, right = TIP] = ARMS.map((arm) =>
    around(arm, { length: 1, turn })
  );
  return {
    head: `M${at(left)}L${at(TIP)}L${at(right)}`,
    shaft: `M${at(tail)}Q${at(control)} ${at(TIP)}`,
  };
}

export const ARROW_AT_REST = arrowStrokes(1, 1);
