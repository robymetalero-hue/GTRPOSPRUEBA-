import React, { useState, useRef } from 'react';

/**
 * Custom hook to add beautiful elastic rebound (bounce) scrolling on boundary limits
 * for touch devices, replicating modern iOS-style inertia and elastic drag.
 */
export function useElasticScroll(enabled = true) {
  const [offsetY, setOffsetY] = useState(0);
  const touchStartRef = useRef<{ y: number; scrollTop: number } | null>(null);

  if (!enabled) {
    return {
      touchHandlers: {},
      style: {}
    };
  }

  const handleTouchStart = (e: React.TouchEvent<HTMLElement>) => {
    const container = e.currentTarget;
    touchStartRef.current = {
      y: e.touches[0].clientY,
      scrollTop: container.scrollTop,
    };
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLElement>) => {
    if (!touchStartRef.current) return;
    const container = e.currentTarget;
    const currentY = e.touches[0].clientY;
    const deltaY = currentY - touchStartRef.current.y;
    const { scrollTop } = touchStartRef.current;
    
    const maxScroll = container.scrollHeight - container.clientHeight;

    // Boundary conditions: top or bottom
    if (scrollTop <= 1 && deltaY > 0) {
      // Pulling down at top boundary -> apply logarithmic-like resistance
      const stretch = Math.min(45, Math.pow(deltaY, 0.65) * 1.8);
      setOffsetY(stretch);
    } else if (scrollTop >= maxScroll - 1 && deltaY < 0) {
      // Pulling up at bottom boundary -> apply logarithmic-like resistance
      const stretch = Math.max(-45, -Math.pow(Math.abs(deltaY), 0.65) * 1.8);
      setOffsetY(stretch);
    } else {
      if (offsetY !== 0) {
        setOffsetY(0);
      }
    }
  };

  const handleTouchEnd = () => {
    touchStartRef.current = null;
    setOffsetY(0);
  };

  return {
    touchHandlers: {
      onTouchStart: handleTouchStart,
      onTouchMove: handleTouchMove,
      onTouchEnd: handleTouchEnd,
    },
    style: {
      transform: offsetY !== 0 ? `translateY(${offsetY}px)` : 'none',
      transition: offsetY === 0 ? 'transform 450ms cubic-bezier(0.175, 0.885, 0.32, 1.275)' : 'none',
      willChange: 'transform',
    }
  };
}
