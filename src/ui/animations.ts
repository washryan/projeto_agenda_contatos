import gsap from 'gsap';

function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

/**
 * Runs a subtle staggered entrance animation for initial interface sections.
 */
export function animateEntrance(targets: HTMLElement[]): void {
  if (targets.length === 0 || prefersReducedMotion()) {
    return;
  }

  gsap.fromTo(
    targets,
    { opacity: 0.85 },
    {
      opacity: 1,
      duration: 0.32,
      stagger: 0.04,
      ease: 'power2.out',
      clearProps: 'opacity',
    },
  );
}

/**
 * Animates newly rendered contact items with a crisp restrained cascade.
 */
export function animateContactItems(items: HTMLElement[]): void {
  if (items.length === 0 || prefersReducedMotion()) {
    return;
  }

  const capped = items.slice(0, 12);
  gsap.fromTo(
    capped,
    { opacity: 0, y: 10 },
    {
      opacity: 1,
      y: 0,
      duration: 0.28,
      stagger: 0.025,
      ease: 'power2.out',
      clearProps: 'transform,opacity',
    },
  );
}

/**
 * Animates a modal panel opening with scale + opacity.
 */
export function animateModalOpen(panel: HTMLElement): void {
  if (prefersReducedMotion()) {
    return;
  }

  gsap.fromTo(
    panel,
    { opacity: 0, y: 10, scale: 0.98 },
    {
      opacity: 1,
      y: 0,
      scale: 1,
      duration: 0.22,
      ease: 'power2.out',
      clearProps: 'transform,opacity',
    },
  );
}
