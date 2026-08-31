// ---------------------------------------------------------------------------
// Responsive Utilities & Media Queries
// Breakpoints for ClawdHQ responsive design
// ---------------------------------------------------------------------------

import { useEffect, useState } from 'react';

// Breakpoint definitions
export const breakpoints = {
  mobile: {
    min: 0,
    max: 767,
    query: '(max-width: 767px)',
  },
  tablet: {
    min: 768,
    max: 1023,
    query: '(min-width: 768px) and (max-width: 1023px)',
  },
  desktop: {
    min: 1024,
    max: Infinity,
    query: '(min-width: 1024px)',
  },
  wide: {
    min: 1280,
    max: Infinity,
    query: '(min-width: 1280px)',
  },
} as const;

// Media query strings for easy use
export const mediaQueries = {
  mobile: breakpoints.mobile.query,
  tablet: breakpoints.tablet.query,
  desktop: breakpoints.desktop.query,
  wide: breakpoints.wide.query,
  tabletAndAbove: '(min-width: 768px)',
  desktopAndAbove: '(min-width: 1024px)',
  mobileAndTablet: '(max-width: 1023px)',
} as const;

// Container max-widths
export const containerWidths = {
  main: 600, // Main content area max-width
  wide: 1280, // Overall container max-width
  leftSidebar: {
    desktop: 275,
    tablet: 88,
  },
  rightSidebar: 350,
} as const;

/**
 * Hook to detect if a media query matches
 * Uses window.matchMedia for efficiency and SSR-safety
 * 
 * @param query - CSS media query string
 * @returns Boolean indicating if query matches
 * 
 * @example
 * const isMobile = useMediaQuery('(max-width: 767px)');
 * const isDesktop = useMediaQuery(mediaQueries.desktop);
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    
    // Check if we're in a browser environment
    if (typeof window === 'undefined' || !window.matchMedia) {
      return;
    }

    const mediaQuery = window.matchMedia(query);
    
    // Set initial value
    setMatches(mediaQuery.matches);

    // Handler for changes
    const handler = (event: MediaQueryListEvent) => {
      setMatches(event.matches);
    };

    // Modern browsers
    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', handler);
      return () => mediaQuery.removeEventListener('change', handler);
    }
    // Fallback for older browsers
    else if (mediaQuery.addListener) {
      mediaQuery.addListener(handler);
      return () => mediaQuery.removeListener(handler);
    }
  }, [query]);

  // Return false during SSR to prevent hydration mismatch
  // Components should handle this gracefully
  return mounted ? matches : false;
}

/**
 * Hook to get current breakpoint
 * Returns the name of the current breakpoint
 * 
 * @returns 'mobile' | 'tablet' | 'desktop' | 'wide'
 */
export function useBreakpoint(): 'mobile' | 'tablet' | 'desktop' | 'wide' {
  const isMobile = useMediaQuery(mediaQueries.mobile);
  const isTablet = useMediaQuery(mediaQueries.tablet);
  const isWide = useMediaQuery(mediaQueries.wide);

  if (isMobile) return 'mobile';
  if (isTablet) return 'tablet';
  if (isWide) return 'wide';
  return 'desktop';
}

/**
 * Hook to check if viewport is at or above a breakpoint
 * 
 * @param breakpoint - Breakpoint name
 * @returns Boolean
 * 
 * @example
 * const isTabletOrLarger = useBreakpointUp('tablet');
 */
export function useBreakpointUp(breakpoint: keyof typeof breakpoints): boolean {
  const min = breakpoints[breakpoint].min;
  return useMediaQuery(`(min-width: ${min}px)`);
}

/**
 * Hook to check if viewport is at or below a breakpoint
 * 
 * @param breakpoint - Breakpoint name
 * @returns Boolean
 * 
 * @example
 * const isTabletOrSmaller = useBreakpointDown('tablet');
 */
export function useBreakpointDown(breakpoint: keyof typeof breakpoints): boolean {
  const max = breakpoints[breakpoint].max;
  if (max === Infinity) return true;
  return useMediaQuery(`(max-width: ${max}px)`);
}

/**
 * Convenience hooks for common breakpoint checks
 */
export function useIsMobile(): boolean {
  return useMediaQuery(mediaQueries.mobile);
}

export function useIsTablet(): boolean {
  return useMediaQuery(mediaQueries.tablet);
}

export function useIsDesktop(): boolean {
  return useMediaQuery(mediaQueries.desktop);
}

export function useIsWide(): boolean {
  return useMediaQuery(mediaQueries.wide);
}

// Implementation notes from spec:
// - Use CSS media queries for performance (not JavaScript) wherever possible
// - Apply display:none for hidden states (SSR-friendly)
// - Avoid JavaScript hiding where possible (causes SSR issues)
// - Use useMediaQuery hook only when conditional logic is required

// CSS class helper for responsive visibility
// These match the responsive wrapper components in /components/responsive/index.tsx
export const responsiveClasses = {
  desktopOnly: 'hidden lg:block',
  tabletOnly: 'hidden md:block lg:hidden',
  mobileOnly: 'block md:hidden',
  tabletAndDesktop: 'hidden md:block',
  mobileAndTablet: 'block lg:hidden',
} as const;
