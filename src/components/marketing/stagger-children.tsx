'use client';

import { Children, useEffect, useRef, type ReactNode } from 'react';

interface StaggerChildrenProps {
  children: ReactNode;
  stagger?: number; // ms between each child reveal
  className?: string;
}

export function StaggerChildren({ children, stagger = 120, className = '' }: StaggerChildrenProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const items = Array.from(el.children);

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          items.forEach((item) => item.classList.add('sr-visible'));
          observer.disconnect();
        }
      },
      { threshold: 0.08, rootMargin: '0px 0px -40px 0px' }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={ref} className={className}>
      {Children.map(children, (child, i) => (
        <div className="sr-hidden" style={{ transitionDelay: `${i * stagger}ms` }}>
          {child}
        </div>
      ))}
    </div>
  );
}
