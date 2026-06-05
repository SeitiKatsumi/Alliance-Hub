import { type ReactNode, useEffect, useRef, useState } from "react";

interface MapWheelGuardProps {
  children: ReactNode;
}

export function MapWheelGuard({ children }: MapWheelGuardProps) {
  const ref = useRef<HTMLDivElement | null>(null);
  const wheelEnabledRef = useRef(false);
  const [wheelEnabled, setWheelEnabled] = useState(false);

  useEffect(() => {
    wheelEnabledRef.current = wheelEnabled;
  }, [wheelEnabled]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    function handleWheel(event: WheelEvent) {
      if (!wheelEnabledRef.current) {
        event.stopImmediatePropagation();
      }
    }

    el.addEventListener("wheel", handleWheel, { capture: true });
    return () => el.removeEventListener("wheel", handleWheel, { capture: true });
  }, []);

  useEffect(() => {
    if (!wheelEnabled) return;

    function handlePointerDown(event: PointerEvent) {
      if (!ref.current?.contains(event.target as Node)) {
        setWheelEnabled(false);
      }
    }

    window.addEventListener("pointerdown", handlePointerDown);
    return () => window.removeEventListener("pointerdown", handlePointerDown);
  }, [wheelEnabled]);

  return (
    <div
      ref={ref}
      className="h-full w-full outline-none"
      onPointerDown={() => setWheelEnabled(true)}
    >
      {children}
    </div>
  );
}
