import { useRef, useState, type ReactNode, type DragEvent } from "react";
import { cn } from "@/lib/utils";
import { applyDroppedFiles } from "@/lib/file-drop";

export function FileDropTarget({ children, disabled = false, compact = false, className }: {
  children: ReactNode; disabled?: boolean; compact?: boolean; className?: string;
}) {
  const root = useRef<HTMLDivElement>(null);
  const depth = useRef(0);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const input = () => root.current?.querySelector<HTMLInputElement>('input[type="file"]');
  const blocked = () => disabled || !input() || input()!.matches(":disabled");
  const hasFiles = (event: DragEvent) => Array.from(event.dataTransfer.types).includes("Files");

  return <div ref={root} role="group" aria-label="Área para anexar arquivos" data-file-drop-target=""
    data-dragging={dragging || undefined}
    className={cn("min-w-0 rounded-lg border border-dashed border-input p-3 transition-colors",
      dragging && "bg-primary/10 ring-2 ring-primary ring-offset-2 ring-offset-background",
      disabled && "opacity-60", className)}
    onChangeCapture={() => setError(null)}
    onDragEnter={event => {
      if (!hasFiles(event)) return;
      event.preventDefault(); event.stopPropagation();
      if (!blocked()) { depth.current++; setDragging(true); }
    }}
    onDragOver={event => {
      if (!hasFiles(event)) return;
      event.preventDefault(); event.stopPropagation();
      event.dataTransfer.dropEffect = blocked() ? "none" : "copy";
    }}
    onDragLeave={event => {
      event.preventDefault(); event.stopPropagation();
      depth.current = Math.max(0, depth.current - 1);
      if (!depth.current) setDragging(false);
    }}
    onDrop={event => {
      if (!hasFiles(event)) return;
      event.preventDefault(); event.stopPropagation();
      depth.current = 0; setDragging(false);
      const field = input();
      if (blocked() || !field) return;
      setError(applyDroppedFiles(field, Array.from(event.dataTransfer.files)));
    }}>
    {children}
    {!compact && <p className="mt-2 text-xs text-muted-foreground">{dragging ? "Solte os arquivos aqui" : "Arraste arquivos para esta área ou use o botão de seleção."}</p>}
    {error && <p role="alert" className="mt-2 text-xs text-destructive">{error}</p>}
  </div>;
}
