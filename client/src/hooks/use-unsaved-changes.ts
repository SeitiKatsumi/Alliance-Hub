import { useEffect, useRef } from "react";

const editors = new Set<{ current: boolean }>();
export function confirmDiscardChanges() {
  if (!Array.from(editors).some(editor => editor.current)) return true;
  if (!window.confirm("Há alterações não salvas. Deseja descartá-las e sair?")) return false;
  editors.forEach(editor => { editor.current = false; });
  return true;
}

// Covers Wouter navigation, native links, browser back and closing/reloading.
export function useUnsavedChanges(dirty: boolean) {
  const pending = useRef(dirty);
  pending.current = dirty;
  useEffect(() => {
    editors.add(pending);
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (pending.current) { event.preventDefault(); event.returnValue = ""; }
    };
    const originals = { pushState: history.pushState, replaceState: history.replaceState };
    let currentUrl = location.href;
    let currentState = history.state;
    for (const method of ["pushState", "replaceState"] as const) {
      history[method] = function(data, unused, url) {
        if (url && new URL(String(url), location.href).href !== location.href && !confirmDiscardChanges()) return;
        originals[method].call(this, data, unused, url);
        currentUrl = location.href; currentState = history.state;
      };
    }
    const click = (event: MouseEvent) => {
      const anchor = (event.target as Element)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (anchor && !anchor.download && anchor.target !== "_blank" && !event.ctrlKey && !event.metaKey && anchor.href !== location.href && !confirmDiscardChanges()) {
        event.preventDefault(); event.stopImmediatePropagation();
      }
    };
    const navigation = (window as any).navigation;
    const navigate = (event: any) => {
      if (event.cancelable && event.destination.url !== location.href && !confirmDiscardChanges()) event.preventDefault();
    };
    const pop = (event: PopStateEvent) => {
      // ponytail: older browsers restore the URL/form, not the history cursor;
      // use a router with indexed history if exact cancelled-back traversal is needed there.
      if (!navigation && !confirmDiscardChanges()) {
        event.stopImmediatePropagation();
        originals.replaceState.call(history, currentState, "", currentUrl);
      } else { currentUrl = location.href; currentState = history.state; }
    };
    window.addEventListener("beforeunload", beforeUnload);
    window.addEventListener("popstate", pop, true);
    document.addEventListener("click", click, true);
    navigation?.addEventListener("navigate", navigate);
    return () => {
      editors.delete(pending);
      Object.assign(history, originals);
      window.removeEventListener("beforeunload", beforeUnload);
      window.removeEventListener("popstate", pop, true);
      document.removeEventListener("click", click, true);
      navigation?.removeEventListener("navigate", navigate);
    };
  }, []);
}
