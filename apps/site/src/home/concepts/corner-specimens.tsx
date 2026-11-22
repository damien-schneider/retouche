import type { ReactNode } from "react";

import { cn } from "../../ui/class-names";
import { useRetouched } from "./scroll-reveal";

function Tile({
  children,
  className,
}: {
  children: ReactNode;
  className: string;
}) {
  return <div className={cn("bg-wash flex p-2", className)}>{children}</div>;
}

function Swatch({ className }: { className: string }) {
  return <div className={cn("bg-brand h-12", className)} />;
}

function Avatar() {
  return <div className="bg-brand size-8 rounded-full" />;
}

function RetouchedTile() {
  const retouched = useRetouched();
  return (
    <Tile className="rounded-[18px]">
      <Swatch
        className={cn(
          "w-16 transition-[border-radius] duration-300",
          retouched ? "rounded-[18px]" : "rounded-[10px]"
        )}
      />
    </Tile>
  );
}

export function CornerSpecimens() {
  return (
    <div className="flex items-center gap-4">
      <RetouchedTile />
      <Tile className="rounded-full">
        <Swatch className="w-16 rounded-full" />
      </Tile>
      <Tile className="rounded-[18px]">
        <Avatar />
      </Tile>
    </div>
  );
}
