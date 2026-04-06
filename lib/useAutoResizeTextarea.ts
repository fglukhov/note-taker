import { useCallback, useEffect, useRef } from 'react';

function resizeEl(el: HTMLTextAreaElement | null) {
  if (!el) return;
  el.style.height = 'auto';
  el.style.height = `${el.scrollHeight}px`;
}

export function useAutoResizeTextarea(value: string) {
  const ref = useRef<HTMLTextAreaElement | null>(null);

  // Resize on every value change (while typing).
  useEffect(() => {
    resizeEl(ref.current);
  }, [value]);

  // Resize immediately when the element mounts (entering edit mode).
  const callbackRef = useCallback((el: HTMLTextAreaElement | null) => {
    ref.current = el;
    resizeEl(el);
  }, []);

  return { ref, callbackRef };
}
