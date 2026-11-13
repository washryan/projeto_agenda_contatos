/**
 * Safe DOM element creation utilities.
 * Never uses innerHTML or insertAdjacentHTML with user-controlled values.
 */

export interface ElementOptions<K extends keyof HTMLElementTagNameMap> {
  readonly className?: string;
  readonly id?: string;
  readonly text?: string;
  readonly attrs?: Readonly<Record<string, string | number | boolean | undefined>>;
  readonly children?: ReadonlyArray<Node | string | null | undefined>;
  readonly on?: Readonly<{
    [E in keyof HTMLElementEventMap]?: (event: HTMLElementEventMap[E]) => void;
  }>;
  readonly _tagHint?: K;
}

export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  options: ElementOptions<K> = {},
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);

  if (options.id) {
    node.id = options.id;
  }

  if (options.className) {
    node.className = options.className;
  }

  if (options.text !== undefined) {
    node.textContent = options.text;
  }

  if (options.attrs) {
    for (const [key, val] of Object.entries(options.attrs)) {
      if (val === undefined || val === false) continue;
      if (val === true) {
        node.setAttribute(key, '');
      } else {
        node.setAttribute(key, String(val));
      }
    }
  }

  if (options.on) {
    for (const [eventName, handler] of Object.entries(options.on)) {
      if (typeof handler === 'function') {
        node.addEventListener(eventName, handler as EventListener);
      }
    }
  }

  if (options.children) {
    for (const child of options.children) {
      if (child === null || child === undefined) continue;
      if (typeof child === 'string') {
        node.appendChild(document.createTextNode(child));
      } else {
        node.appendChild(child);
      }
    }
  }

  return node;
}

export function clearChildren(container: HTMLElement): void {
  container.replaceChildren();
}
