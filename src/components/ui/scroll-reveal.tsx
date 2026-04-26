"use client";

import { useEffect, useRef } from "react";

// Single shared IntersectionObserver for every ScrollReveal on the page.
// Per-instance observers add up fast on the landing page (~10 sections);
// pooling them cuts setup cost during hydration and keeps the main thread
// quieter right after FCP.
let sharedObserver: IntersectionObserver | null = null;
const delays = new WeakMap<Element, number>();

function getObserver() {
  if (typeof window === "undefined") return null;
  sharedObserver ??= new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        const el = entry.target as HTMLElement;
        const delay = delays.get(el) ?? 0;
        if (delay) el.style.animationDelay = `${delay}ms`;
        el.classList.add("revealed");
        sharedObserver?.unobserve(el);
        delays.delete(el);
      }
    },
    { threshold: 0.1 },
  );
  return sharedObserver;
}

export function ScrollReveal({
  children,
  delay = 0,
  className = "",
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = getObserver();
    if (!observer) return;
    if (delay) delays.set(el, delay);
    observer.observe(el);
    return () => {
      observer.unobserve(el);
      delays.delete(el);
    };
  }, [delay]);

  return (
    <div ref={ref} className={`scroll-reveal ${className}`}>
      {children}
    </div>
  );
}
