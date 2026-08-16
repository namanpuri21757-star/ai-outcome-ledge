/* ===================================================================
   BlurText — vendored from React Bits, unmodified except where marked.

   Source: https://reactbits.dev/r/BlurText-TS-CSS, copied verbatim on
   2026-08-15 for the same reason as Waves: the jsrepo CLI endpoint no
   longer serves a manifest. Upstream dependency `motion` is installed.

   Two local changes:

     1. `tag`. Upstream always renders a <p>. The headline of a page that
        renders without the masthead is that page's h1, and a <p> cannot
        carry it.
     2. `still`. Reduced motion gets the finished state — every word at
        full opacity, no blur, no offset, no observer, no animation.
        The global stylesheet can only reach CSS animations, and this
        one is driven from JavaScript.
     3. `will-change` is dropped once the reveal has finished. Upstream
        sets it statically, which pins one compositor layer per word for
        the life of the page — and a permanently promoted layer is
        rasterised slightly differently from one load to the next, so
        the finished headline was not quite the same picture twice.

   No random values anywhere: the stagger is index * delay, so the reveal
   runs the same way on every load.
   =================================================================== */

import { motion, type Transition } from 'motion/react';
import { useEffect, useRef, useState, useMemo, type ElementType } from 'react';

type BlurTextProps = {
  text?: string;
  delay?: number;
  className?: string;
  animateBy?: 'words' | 'letters';
  direction?: 'top' | 'bottom';
  threshold?: number;
  rootMargin?: string;
  animationFrom?: Record<string, string | number>;
  animationTo?: Array<Record<string, string | number>>;
  easing?: (t: number) => number;
  onAnimationComplete?: () => void;
  stepDuration?: number;
  /** Local: the element to render. A landing page headline is an h1. */
  tag?: ElementType;
  /** Local: render the finished state, for prefers-reduced-motion. */
  still?: boolean;
};

const buildKeyframes = (
  from: Record<string, string | number>,
  steps: Array<Record<string, string | number>>
): Record<string, Array<string | number>> => {
  const keys = new Set<string>([...Object.keys(from), ...steps.flatMap(s => Object.keys(s))]);

  const keyframes: Record<string, Array<string | number>> = {};
  keys.forEach(k => {
    keyframes[k] = [from[k], ...steps.map(s => s[k])];
  });
  return keyframes;
};

const BlurText: React.FC<BlurTextProps> = ({
  text = '',
  delay = 200,
  className = '',
  animateBy = 'words',
  direction = 'top',
  threshold = 0.1,
  rootMargin = '0px',
  animationFrom,
  animationTo,
  easing = (t: number) => t,
  onAnimationComplete,
  stepDuration = 0.35,
  tag: Tag = 'p',
  still = false
}) => {
  const elements = animateBy === 'words' ? text.split(' ') : text.split('');
  const [inView, setInView] = useState(false);
  const [settled, setSettled] = useState(false);
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    if (still || !ref.current) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
          observer.unobserve(ref.current as Element);
        }
      },
      { threshold, rootMargin }
    );
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, [threshold, rootMargin, still]);

  const defaultFrom = useMemo(
    () =>
      direction === 'top' ? { filter: 'blur(10px)', opacity: 0, y: -50 } : { filter: 'blur(10px)', opacity: 0, y: 50 },
    [direction]
  );

  const defaultTo = useMemo(
    () => [
      {
        filter: 'blur(5px)',
        opacity: 0.5,
        y: direction === 'top' ? 5 : -5
      },
      { filter: 'blur(0px)', opacity: 1, y: 0 }
    ],
    [direction]
  );

  const fromSnapshot = animationFrom ?? defaultFrom;
  const toSnapshots = animationTo ?? defaultTo;

  const stepCount = toSnapshots.length + 1;
  const totalDuration = stepDuration * (stepCount - 1);
  const times = Array.from({ length: stepCount }, (_, i) => (stepCount === 1 ? 0 : i / (stepCount - 1)));

  if (still) {
    return <Tag className={className}>{text}</Tag>;
  }

  return (
    <Tag ref={ref} className={className} style={{ display: 'flex', flexWrap: 'wrap' }}>
      {elements.map((segment, index) => {
        const animateKeyframes = buildKeyframes(fromSnapshot, toSnapshots);

        const spanTransition: Transition = {
          duration: totalDuration,
          times,
          delay: (index * delay) / 1000,
          ease: easing
        };

        return (
          <motion.span
            key={index}
            initial={fromSnapshot}
            animate={inView ? animateKeyframes : fromSnapshot}
            transition={spanTransition}
            onAnimationComplete={
              index === elements.length - 1
                ? () => {
                    setSettled(true);
                    onAnimationComplete?.();
                  }
                : undefined
            }
            style={{
              display: 'inline-block',
              willChange: settled ? 'auto' : 'transform, filter, opacity'
            }}
          >
            {segment === ' ' ? '\u00A0' : segment}
            {animateBy === 'words' && index < elements.length - 1 && '\u00A0'}
          </motion.span>
        );
      })}
    </Tag>
  );
};

export default BlurText;
