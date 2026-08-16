/* ===================================================================
   CountUp — vendored from React Bits, unmodified except where marked.

   Source: https://reactbits.dev/r/CountUp-TS-CSS, copied verbatim on
   2026-08-15. Same reason as the other two: the jsrepo registry endpoint
   the CLI reads answers with the site's HTML shell, so `jsrepo add`
   cannot install it. Upstream dependency `motion` is already installed.

   Two local changes:

     1. `still` renders the finished number and starts no spring, which
        is what prefers-reduced-motion gets. A number that animates is
        motion whatever the stylesheet says.
     2. `format`. Upstream formats with Intl.NumberFormat. Every figure
        in this app goes through `usd()` in lib/format.ts, and a second
        way to write a dollar amount is exactly the kind of drift this
        project exists to catch — so the caller passes the formatter.
     3. The number lands on the number. Upstream paints whatever the
        spring last emitted, and a spring approaches its target rather
        than arriving at it — $8.393B read as $8.37B on screen a full
        two seconds after it had stopped moving. Once the stated
        duration is up this writes the target exactly and stops
        listening, so the figure a reader ends up looking at is the
        figure `totals()` computed.
     4. The figure survives a re-render. Upstream repaints the *start*
        value whenever its formatter changes identity, and a formatter
        passed as a prop changes identity on every render of the parent.
        Clicking anything on the page therefore reset every finished
        counter on it to zero. The formatter is held in a ref, and the
        repaint only happens while the count has not landed.

   No random values: the spring runs from a fixed `from` to a fixed `to`,
   so every load counts the same way to the same number.
   =================================================================== */

import { useInView, useMotionValue, useSpring } from 'motion/react';
import { useCallback, useEffect, useRef } from 'react';

interface CountUpProps {
  to: number;
  from?: number;
  direction?: 'up' | 'down';
  delay?: number;
  duration?: number;
  className?: string;
  startWhen?: boolean;
  separator?: string;
  /** Local: the finished value, no spring. For reduced motion. */
  still?: boolean;
  /** Local: the app's own formatter, so one quantity is written one way. */
  format?: (value: number) => string;
  onStart?: () => void;
  onEnd?: () => void;
}

export default function CountUp({
  to,
  from = 0,
  direction = 'up',
  delay = 0,
  duration = 2,
  className = '',
  startWhen = true,
  separator = '',
  still = false,
  format,
  onStart,
  onEnd
}: CountUpProps) {
  const ref = useRef<HTMLSpanElement>(null);
  /** Local: true once the figure has been written exactly. */
  const landed = useRef(false);
  /** Local: the formatter, out of the effect dependency lists. */
  const formatRef = useRef<(value: number) => string>(() => '');
  const motionValue = useMotionValue(direction === 'down' ? to : from);

  const damping = 20 + 40 * (1 / duration);
  const stiffness = 100 * (1 / duration);

  const springValue = useSpring(motionValue, {
    damping,
    stiffness
  });

  const isInView = useInView(ref, { once: true, margin: '0px' });

  const getDecimalPlaces = (num: number): number => {
    const str = num.toString();
    if (str.includes('.')) {
      const decimals = str.split('.')[1];
      if (parseInt(decimals) !== 0) {
        return decimals.length;
      }
    }
    return 0;
  };

  const maxDecimals = Math.max(getDecimalPlaces(from), getDecimalPlaces(to));

  const formatValue = useCallback(
    (latest: number) => {
      if (format) return format(latest);
      const hasDecimals = maxDecimals > 0;

      const options: Intl.NumberFormatOptions = {
        useGrouping: !!separator,
        minimumFractionDigits: hasDecimals ? maxDecimals : 0,
        maximumFractionDigits: hasDecimals ? maxDecimals : 0
      };

      const formattedNumber = Intl.NumberFormat('en-US', options).format(latest);

      return separator ? formattedNumber.replace(/,/g, separator) : formattedNumber;
    },
    [maxDecimals, separator, format]
  );

  formatRef.current = formatValue;

  // The start value, painted once per set of inputs. `formatValue` is
  // deliberately not a dependency: it changes identity on every render
  // of the parent, and repainting the start value over a finished count
  // is how a settled figure turns back into zero.
  useEffect(() => {
    landed.current = false;
    if (ref.current) {
      ref.current.textContent = formatRef.current(
        still ? to : direction === 'down' ? to : from,
      );
    }
  }, [from, to, direction, still]);

  useEffect(() => {
    if (still) return;
    if (isInView && startWhen) {
      if (typeof onStart === 'function') {
        onStart();
      }

      const timeoutId = setTimeout(() => {
        motionValue.set(direction === 'down' ? from : to);
      }, delay * 1000);

      const durationTimeoutId = setTimeout(
        () => {
          landed.current = true;
          if (ref.current) {
            ref.current.textContent = formatRef.current(direction === 'down' ? from : to);
          }
          if (typeof onEnd === 'function') {
            onEnd();
          }
        },
        delay * 1000 + duration * 1000
      );

      return () => {
        clearTimeout(timeoutId);
        clearTimeout(durationTimeoutId);
      };
    }
  }, [isInView, startWhen, motionValue, direction, from, to, delay, onStart, onEnd, duration, still]);

  useEffect(() => {
    if (still) return;
    const unsubscribe = springValue.on('change', (latest: number) => {
      if (landed.current) return;
      if (ref.current) {
        ref.current.textContent = formatRef.current(latest);
      }
    });

    return () => unsubscribe();
  }, [springValue, still]);

  return <span className={className} ref={ref} />;
}
