export function qs<T extends HTMLElement = HTMLElement>(
  sel: string,
  root: ParentNode = document,
): T {
  const el = root.querySelector<T>(sel);
  if (!el) throw new Error(`qs: element not found: ${sel}`);
  return el;
}

export function qsa<T extends HTMLElement = HTMLElement>(
  sel: string,
  root: ParentNode = document,
): T[] {
  return Array.from(root.querySelectorAll<T>(sel));
}

export function on<K extends keyof HTMLElementEventMap>(
  el: HTMLElement,
  event: K,
  handler: (e: HTMLElementEventMap[K]) => void,
): () => void {
  el.addEventListener(event, handler);
  return () => el.removeEventListener(event, handler);
}
