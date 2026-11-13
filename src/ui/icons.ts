const SVG_NS = 'http://www.w3.org/2000/svg';

export type IconName =
  | 'plus'
  | 'search'
  | 'star'
  | 'star-filled'
  | 'phone'
  | 'message'
  | 'copy'
  | 'edit'
  | 'trash'
  | 'download'
  | 'upload'
  | 'close'
  | 'arrow-up-right'
  | 'shield'
  | 'check'
  | 'alert'
  | 'users'
  | 'filter-clear';

interface IconShape {
  readonly viewBox?: string;
  readonly paths: readonly string[];
  readonly circles?: ReadonlyArray<{ cx: number; cy: number; r: number }>;
  readonly filled?: boolean;
}

const ICONS: Record<IconName, IconShape> = {
  plus: {
    paths: ['M12 5v14', 'M5 12h14'],
  },
  search: {
    circles: [{ cx: 11, cy: 11, r: 7 }],
    paths: ['m21 21-4.35-4.35'],
  },
  star: {
    paths: [
      'M12 2.5 14.9 8.4l6.5.95-4.7 4.58 1.11 6.47L12 17.35 6.19 20.4l1.11-6.47L2.6 9.35l6.5-.95L12 2.5Z',
    ],
  },
  'star-filled': {
    filled: true,
    paths: [
      'M12 2.5 14.9 8.4l6.5.95-4.7 4.58 1.11 6.47L12 17.35 6.19 20.4l1.11-6.47L2.6 9.35l6.5-.95L12 2.5Z',
    ],
  },
  phone: {
    paths: [
      'M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92Z',
    ],
  },
  message: {
    paths: [
      'M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5Z',
    ],
  },
  copy: {
    paths: [
      'M9 9h11v11H9z',
      'M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1',
    ],
  },
  edit: {
    paths: [
      'M12 20h9',
      'M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z',
    ],
  },
  trash: {
    paths: [
      'M3 6h18',
      'M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6',
      'M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2',
    ],
  },
  download: {
    paths: [
      'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4',
      'm7 10 5 5 5-5',
      'M12 15V3',
    ],
  },
  upload: {
    paths: [
      'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4',
      'm17 8-5-5-5 5',
      'M12 3v12',
    ],
  },
  close: {
    paths: ['M18 6 6 18', 'M6 6l12 12'],
  },
  'arrow-up-right': {
    paths: ['M7 17 17 7', 'M7 7h10v10'],
  },
  shield: {
    paths: [
      'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z',
      'm9 12 2 2 4-4',
    ],
  },
  check: {
    paths: ['M20 6 9 17l-5-5'],
  },
  alert: {
    paths: [
      'M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z',
      'M12 9v4',
      'M12 17h.01',
    ],
  },
  users: {
    paths: [
      'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2',
      'M22 21v-2a4 4 0 0 0-3-3.87',
      'M16 3.13a4 4 0 0 1 0 7.75',
    ],
    circles: [{ cx: 9, cy: 7, r: 4 }],
  },
  'filter-clear': {
    paths: ['M22 3H2l8 9.46V19l4 2v-8.54L22 3Z', 'm18 14 4 4', 'm22 14-4 4'],
  },
};

export function createIcon(name: IconName, size = 18): SVGSVGElement {
  const shape = ICONS[name];
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('width', String(size));
  svg.setAttribute('height', String(size));
  svg.setAttribute('viewBox', shape.viewBox ?? '0 0 24 24');
  svg.setAttribute('fill', shape.filled ? 'currentColor' : 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '2');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');

  for (const d of shape.paths) {
    const path = document.createElementNS(SVG_NS, 'path');
    path.setAttribute('d', d);
    svg.appendChild(path);
  }

  if (shape.circles) {
    for (const c of shape.circles) {
      const circle = document.createElementNS(SVG_NS, 'circle');
      circle.setAttribute('cx', String(c.cx));
      circle.setAttribute('cy', String(c.cy));
      circle.setAttribute('r', String(c.r));
      svg.appendChild(circle);
    }
  }

  return svg;
}
