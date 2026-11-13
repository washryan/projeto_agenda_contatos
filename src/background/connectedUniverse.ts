interface WebNode {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  tone: 'crimson' | 'electric' | 'ice';
}

export interface BackgroundController {
  destroy(): void;
}

const NODE_COLORS = {
  crimson: 'rgba(227, 38, 54, 0.72)',
  electric: 'rgba(40, 107, 255, 0.75)',
  ice: 'rgba(244, 247, 251, 0.42)',
} as const;

/**
 * Renders the "Connected Universe" interactive particle-web backdrop on Canvas 2D.
 * Respects `prefers-reduced-motion`, pauses on hidden tabs, and degrades gracefully
 * to a static architectural web frame when motion is reduced or hardware is constrained.
 */
export function initConnectedUniverse(canvas: HTMLCanvasElement): BackgroundController {
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    return { destroy: () => undefined };
  }

  const reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
  const finePointerQuery = window.matchMedia('(pointer: fine)');

  let width = 0;
  let height = 0;
  let dpr = 1;
  let nodes: WebNode[] = [];
  let rafId: number | null = null;
  let destroyed = false;

  const pointer = { x: -9999, y: -9999, active: false };

  function computeNodeCount(): number {
    const area = width * height;
    const isLowCore =
      typeof navigator !== 'undefined' &&
      typeof navigator.hardwareConcurrency === 'number' &&
      navigator.hardwareConcurrency <= 2;

    const base = width < 640 ? 18 : width < 1024 ? 28 : Math.min(44, Math.floor(area / 36000));
    return isLowCore ? Math.max(12, Math.floor(base * 0.6)) : Math.max(16, base);
  }

  function seedNodes(): void {
    const count = computeNodeCount();
    const tones: WebNode['tone'][] = ['electric', 'crimson', 'ice'];
    nodes = Array.from({ length: count }, (_, index) => ({
      x: Math.random() * width,
      y: Math.random() * height,
      vx: (Math.random() - 0.5) * 0.36,
      vy: (Math.random() - 0.5) * 0.36,
      radius: index % 5 === 0 ? 2.3 : 1.5,
      tone: tones[index % tones.length] ?? 'electric',
    }));
  }

  function resize(): void {
    width = window.innerWidth;
    height = window.innerHeight;
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    ctx?.setTransform(dpr, 0, 0, dpr, 0, 0);
    seedNodes();
    drawFrame(false);
  }

  function drawFrame(stepPositions: boolean): void {
    if (!ctx || destroyed) return;

    ctx.clearRect(0, 0, width, height);

    const maxDist = width < 640 ? 115 : 155;
    const maxDistSq = maxDist * maxDist;

    if (stepPositions) {
      for (const node of nodes) {
        node.x += node.vx;
        node.y += node.vy;

        if (node.x <= 0 || node.x >= width) node.vx *= -1;
        if (node.y <= 0 || node.y >= height) node.vy *= -1;

        node.x = Math.max(0, Math.min(width, node.x));
        node.y = Math.max(0, Math.min(height, node.y));

        if (pointer.active && finePointerQuery.matches) {
          const dx = pointer.x - node.x;
          const dy = pointer.y - node.y;
          const distSq = dx * dx + dy * dy;
          if (distSq > 900 && distSq < 26000) {
            node.x += dx * 0.0025;
            node.y += dy * 0.0025;
          }
        }
      }
    }

    // Draw subtle web connections
    ctx.lineWidth = 0.8;
    for (let i = 0; i < nodes.length; i++) {
      const a = nodes[i];
      if (!a) continue;

      for (let j = i + 1; j < nodes.length; j++) {
        const b = nodes[j];
        if (!b) continue;

        const dx = a.x - b.x;
        const dy = a.y - b.y;
        const distSq = dx * dx + dy * dy;

        if (distSq < maxDistSq) {
          const alpha = (1 - Math.sqrt(distSq) / maxDist) * 0.22;
          const isAccentPair = a.tone === 'crimson' || b.tone === 'crimson';
          ctx.strokeStyle = isAccentPair
            ? `rgba(227, 38, 54, ${alpha.toFixed(3)})`
            : `rgba(40, 107, 255, ${alpha.toFixed(3)})`;
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.stroke();
        }
      }

      // Connect nearby nodes softly to pointer on fine-pointer desktop
      if (pointer.active && finePointerQuery.matches && !reducedMotionQuery.matches) {
        const pdx = a.x - pointer.x;
        const pdy = a.y - pointer.y;
        const pDistSq = pdx * pdx + pdy * pdy;
        if (pDistSq < maxDistSq * 1.15) {
          const alpha = (1 - Math.sqrt(pDistSq) / (maxDist * 1.07)) * 0.34;
          ctx.strokeStyle = `rgba(227, 38, 54, ${alpha.toFixed(3)})`;
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(pointer.x, pointer.y);
          ctx.stroke();
        }
      }
    }

    // Draw nodes
    for (const node of nodes) {
      ctx.fillStyle = NODE_COLORS[node.tone];
      ctx.beginPath();
      ctx.arc(node.x, node.y, node.radius, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function stopLoop(): void {
    if (rafId !== null) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
  }

  function startLoop(): void {
    if (destroyed || reducedMotionQuery.matches || document.hidden || rafId !== null) {
      return;
    }

    const tick = () => {
      if (destroyed || reducedMotionQuery.matches || document.hidden) {
        rafId = null;
        return;
      }
      drawFrame(true);
      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
  }

  function handlePointerMove(event: PointerEvent): void {
    pointer.x = event.clientX;
    pointer.y = event.clientY;
    pointer.active = true;
  }

  function handlePointerLeave(): void {
    pointer.active = false;
  }

  function handleVisibilityChange(): void {
    if (document.hidden) {
      stopLoop();
    } else if (!reducedMotionQuery.matches) {
      startLoop();
    }
  }

  function handleMotionPreferenceChange(): void {
    if (reducedMotionQuery.matches) {
      stopLoop();
      drawFrame(false);
    } else {
      startLoop();
    }
  }

  resize();
  if (!reducedMotionQuery.matches && !document.hidden) {
    startLoop();
  }

  window.addEventListener('resize', resize, { passive: true });
  window.addEventListener('pointermove', handlePointerMove, { passive: true });
  window.addEventListener('pointerleave', handlePointerLeave, { passive: true });
  document.addEventListener('visibilitychange', handleVisibilityChange);
  reducedMotionQuery.addEventListener('change', handleMotionPreferenceChange);

  return {
    destroy() {
      destroyed = true;
      stopLoop();
      window.removeEventListener('resize', resize);
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerleave', handlePointerLeave);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      reducedMotionQuery.removeEventListener('change', handleMotionPreferenceChange);
    },
  };
}
