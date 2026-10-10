import {useEffect,useState, type RefObject} from "react";
export interface ElementSize {
  width: number;
  height: number;
}

/**
 * Rendered size of an element (ResizeObserver), for SVG charts drawn in real
 * pixels. `{ width: 0, height: 0 }` during SSR and before the first measure.
 */
export function useElementSize(ref: RefObject<HTMLElement | null>): ElementSize {
  const [size, setSize] = useState<ElementSize>({ width: 0, height: 0 });

  useEffect(() => {
    const element = ref.current;
    if (!element) {
      return;
    }

    function measure() {
      if (!element) {
        return;
      }
      const rect = element.getBoundingClientRect();
      const width = Math.round(rect.width);
      const height = Math.round(rect.height);
      setSize((current) =>
        current.width === width && current.height === height
          ? current
          : { width, height },
      );
    }

    measure();
    if (typeof ResizeObserver === "undefined") {
      return;
    }
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [ref]);

  return size;
}
