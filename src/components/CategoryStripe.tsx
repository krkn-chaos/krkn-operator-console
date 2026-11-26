/**
 * CategoryStripe - category color marker for a list row.
 *
 * Renders the categories assigned to an entity as an equal-height gradient
 * marker on the left edge of its row, expanding on hover/focus into a tooltip
 * that lists the categories. Extracted from the run list so file rows can use
 * the same marker.
 *
 * The component positions itself absolutely, so it must be rendered inside an
 * element with `position: relative` whose box spans the intended row.
 */

import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import type { CategoryResponse } from '../types/api';

interface CategoryStripeProps {
  categories: CategoryResponse[];
}

// PatternFly's active sidebar marker uses BorderWidth--xl (4px by default).
const CATEGORY_STRIPE_NARROW_WIDTH = 'var(--pf-v5-global--BorderWidth--xl, 4px)';
const CATEGORY_STRIPE_WIDE_REFERENCE_WIDTH_MM = 3.8;
const CATEGORY_STRIPE_WIDE_WIDTH = (CATEGORY_STRIPE_WIDE_REFERENCE_WIDTH_MM * 0.85).toFixed(2) + 'mm';
const CATEGORY_STRIPE_TRANSITION_MS = 180;
const CATEGORY_TOOLTIP_CLOSE_DELAY_MS = 250;
const CATEGORY_TOOLTIP_VIEWPORT_GUTTER = 8;
const CATEGORY_TOOLTIP_MAX_WIDTH_REM = 18.75;
const CATEGORY_TOOLTIP_ARROW_OUTSET_REM = 0.6629;

interface TooltipPosition {
  left: number;
  top: number;
  maxWidth: number;
  side: 'left' | 'right';
}

function getCategoryStripeGradient(categories: CategoryResponse[]): string {
  const stops = categories.flatMap((category, index) => {
    const start = ((index / categories.length) * 100).toFixed(4);
    const end = (((index + 1) / categories.length) * 100).toFixed(4);
    const color = category.color || '#6c757d';
    return [`${color} ${start}%`, `${color} ${end}%`];
  });

  return `linear-gradient(to bottom, ${stops.join(', ')})`;
}

/** Renders equal-height category color segments at the left of a run row. */
export function CategoryStripe({ categories }: CategoryStripeProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [isTooltipVisible, setIsTooltipVisible] = useState(false);
  const [tooltipPosition, setTooltipPosition] = useState<TooltipPosition | null>(null);
  const tooltipId = useId();
  const stripeRef = useRef<HTMLDivElement>(null);
  const visualStripeRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const revealTimerRef = useRef<number | null>(null);
  const hideTimerRef = useRef<number | null>(null);

  const clearRevealTimer = useCallback(() => {
    if (revealTimerRef.current !== null) {
      window.clearTimeout(revealTimerRef.current);
      revealTimerRef.current = null;
    }
  }, []);

  const clearHideTimer = useCallback(() => {
    if (hideTimerRef.current !== null) {
      window.clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
  }, []);

  const updateTooltipPosition = useCallback(() => {
    const visualStripeElement = visualStripeRef.current;
    if (!visualStripeElement) return;

    const visualStripeRect = visualStripeElement.getBoundingClientRect();
    const rootFontSize = Number.parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
    const arrowOutset = rootFontSize * CATEGORY_TOOLTIP_ARROW_OUTSET_REM;
    const viewportWidth = document.documentElement.clientWidth || window.innerWidth;
    const viewportGutter = Math.min(CATEGORY_TOOLTIP_VIEWPORT_GUTTER, viewportWidth / 2);
    const maxTooltipWidth = Math.max(1, Math.min(
      rootFontSize * CATEGORY_TOOLTIP_MAX_WIDTH_REM,
      viewportWidth - viewportGutter * 2,
    ));
    const anchorX = visualStripeRect.right;
    const availableRight = Math.max(1, viewportWidth - viewportGutter - anchorX - arrowOutset);
    const availableLeft = Math.max(1, anchorX - arrowOutset - viewportGutter);
    const side = availableRight >= availableLeft ? 'right' : 'left';
    const availableOnSide = side === 'right' ? availableRight : availableLeft;
    const tooltipMaxWidth = Math.min(maxTooltipWidth, availableOnSide);
    const tooltipWidth = Math.min(
      tooltipMaxWidth,
      tooltipRef.current?.getBoundingClientRect().width || tooltipMaxWidth,
    );

    setTooltipPosition((current) => {
      const next: TooltipPosition = {
        left: side === 'right' ? anchorX + arrowOutset : anchorX - arrowOutset - tooltipWidth,
        top: visualStripeRect.top + visualStripeRect.height / 2,
        maxWidth: tooltipMaxWidth,
        side,
      };
      if (current
        && Math.abs(current.left - next.left) < 0.5
        && Math.abs(current.top - next.top) < 0.5
        && Math.abs(current.maxWidth - next.maxWidth) < 0.5
        && current.side === next.side) {
        return current;
      }
      return next;
    });
  }, []);

  const revealTooltip = useCallback(() => {
    updateTooltipPosition();
    setIsTooltipVisible(true);
  }, [updateTooltipPosition]);

  const startHover = useCallback(() => {
    clearHideTimer();
    setIsHovered(true);
    if (revealTimerRef.current === null && !isTooltipVisible) {
      revealTimerRef.current = window.setTimeout(() => {
        revealTimerRef.current = null;
        revealTooltip();
      }, CATEGORY_STRIPE_TRANSITION_MS + 50);
    }
  }, [clearHideTimer, isTooltipVisible, revealTooltip]);

  const finishHover = useCallback(() => {
    clearRevealTimer();
    clearHideTimer();
    hideTimerRef.current = window.setTimeout(() => {
      hideTimerRef.current = null;
      setIsHovered(false);
      setIsTooltipVisible(false);
    }, CATEGORY_TOOLTIP_CLOSE_DELAY_MS);
  }, [clearHideTimer, clearRevealTimer]);

  const endFocus = useCallback(() => {
    clearRevealTimer();
    clearHideTimer();
    setIsHovered(false);
    setIsTooltipVisible(false);
  }, [clearHideTimer, clearRevealTimer]);

  useEffect(() => {
    return () => {
      clearRevealTimer();
      clearHideTimer();
    };
  }, [clearHideTimer, clearRevealTimer]);

  useLayoutEffect(() => {
    if (!isTooltipVisible) return;

    updateTooltipPosition();
    window.addEventListener('resize', updateTooltipPosition);
    window.addEventListener('scroll', updateTooltipPosition, true);
    const observer = typeof ResizeObserver === 'undefined'
      ? null
      : new ResizeObserver(updateTooltipPosition);
    if (observer && stripeRef.current) observer.observe(stripeRef.current);
    if (observer && visualStripeRef.current) observer.observe(visualStripeRef.current);

    return () => {
      window.removeEventListener('resize', updateTooltipPosition);
      window.removeEventListener('scroll', updateTooltipPosition, true);
      observer?.disconnect();
    };
  }, [isTooltipVisible, updateTooltipPosition]);

  if (categories.length === 0) return null;

  return (
    <div
      ref={stripeRef}
      role="group"
      tabIndex={0}
      aria-label={`Categories: ${categories.map((category) => category.name).join(', ')}`}
      aria-describedby={isTooltipVisible ? tooltipId : undefined}
      onMouseEnter={(event) => {
        if (tooltipRef.current?.contains(event.target as Node)) clearHideTimer();
        else startHover();
      }}
      onMouseLeave={finishHover}
      onFocus={() => {
        startHover();
      }}
      onBlur={endFocus}
      style={{
        position: 'absolute',
        left: 0,
        top: 0,
        bottom: 0,
        // Keep the hit area to the collapsed marker; the expanded visible stripe can overflow it.
        width: CATEGORY_STRIPE_NARROW_WIDTH,
      }}
    >
      <div
        ref={visualStripeRef}
        data-testid="category-stripe-visual"
        aria-hidden="true"
        onMouseEnter={startHover}
        onMouseLeave={finishHover}
        onTransitionEnd={(event) => {
          if (event.propertyName === 'width' && isHovered) {
            clearRevealTimer();
            revealTooltip();
          }
        }}
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          bottom: 0,
          width: isHovered ? CATEGORY_STRIPE_WIDE_WIDTH : CATEGORY_STRIPE_NARROW_WIDTH,
          transition: 'width ' + CATEGORY_STRIPE_TRANSITION_MS + 'ms ease-out',
          overflow: 'hidden',
          borderRadius: 0,
          backgroundImage: getCategoryStripeGradient(categories),
        }}
      />
      {isTooltipVisible && (
        <div
          ref={tooltipRef}
          id={tooltipId}
          role="tooltip"
          className={`pf-v5-c-tooltip pf-m-${tooltipPosition?.side ?? 'right'}`}
          onMouseEnter={clearHideTimer}
          onMouseLeave={finishHover}
          style={{
            position: 'fixed',
            left: `${tooltipPosition?.left ?? 0}px`,
            top: tooltipPosition?.top ?? 0,
            transform: 'translateY(-50%)',
            width: 'max-content',
            maxWidth: `${tooltipPosition?.maxWidth ?? 300}px`,
            boxSizing: 'border-box',
            overflowWrap: 'anywhere',
            zIndex: 9999,
          }}
        >
          <div
            className="pf-v5-c-tooltip__arrow"
            style={tooltipPosition?.side === 'left'
              ? { right: 0, left: 'auto' }
              : { left: 0, right: 'auto' }}
          />
          <div className="pf-v5-c-tooltip__content pf-m-text-align-left">
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
              <strong>Categories:</strong>
              {categories.map((category) => (
                <span key={category.name} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span
                    aria-hidden="true"
                    style={{
                      width: '0.5rem',
                      height: '0.5rem',
                      borderRadius: '50%',
                      backgroundColor: category.color || '#6c757d',
                      display: 'inline-block',
                      flexShrink: 0,
                    }}
                  />
                  <span style={{ minWidth: 0, overflowWrap: 'anywhere' }}>{category.name}</span>
                </span>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
