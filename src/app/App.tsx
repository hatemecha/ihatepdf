import Lenis from "lenis";
import { useEffect, useRef, type RefObject } from "react";
import { useLocation } from "react-router-dom";

import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { AppRoutes } from "@/app/routes";
import { cn } from "@/lib/utils";
import { shouldUseSmoothPageScroll } from "@/lib/scrollRoutes";

interface ScrollToHashProps {
  lenisRef: RefObject<Lenis | null>;
  scrollContainerRef: RefObject<HTMLDivElement | null>;
}

function ScrollToHash({ lenisRef, scrollContainerRef }: ScrollToHashProps) {
  const { hash, pathname } = useLocation();

  useEffect(() => {
    if (hash) {
      const id = hash.replace("#", "");
      const node = document.getElementById(id);
      if (node) {
        if (lenisRef.current) {
          lenisRef.current.scrollTo(node, { duration: 0.85 });
          return;
        }
        node.scrollIntoView({ behavior: "smooth", block: "start" });
        return;
      }
    }
    if (!hash) {
      if (lenisRef.current) {
        lenisRef.current.scrollTo(0, { immediate: true });
        return;
      }
      const scrollTarget = scrollContainerRef.current;
      if (scrollTarget) {
        scrollTarget.scrollTo({ top: 0, left: 0, behavior: "auto" });
      }
    }
  }, [lenisRef, pathname, hash, scrollContainerRef]);

  return null;
}

export function App() {
  const { pathname } = useLocation();
  const useSmoothPageScroll = shouldUseSmoothPageScroll(pathname);
  const isToolWorkspace = !useSmoothPageScroll;
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const scrollContentRef = useRef<HTMLDivElement | null>(null);
  const lenisRef = useRef<Lenis | null>(null);

  useEffect(() => {
    if (!useSmoothPageScroll) {
      return;
    }

    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    if (
      prefersReducedMotion ||
      !scrollContainerRef.current ||
      !scrollContentRef.current
    ) {
      return;
    }

    const lenis = new Lenis({
      wrapper: scrollContainerRef.current,
      content: scrollContentRef.current,
      lerp: 0.08,
      wheelMultiplier: 0.9,
      touchMultiplier: 1.1,
      syncTouch: false,
    });
    let frame = 0;

    const raf = (time: number) => {
      lenis.raf(time);
      frame = requestAnimationFrame(raf);
    };

    lenisRef.current = lenis;
    frame = requestAnimationFrame(raf);

    return () => {
      cancelAnimationFrame(frame);
      lenis.destroy();
      lenisRef.current = null;
    };
  }, [useSmoothPageScroll]);

  return (
    <div className="flex h-dvh flex-col overflow-hidden">
      <SiteHeader />
      <ScrollToHash
        lenisRef={lenisRef}
        scrollContainerRef={scrollContainerRef}
      />
      <div
        ref={scrollContainerRef}
        className={cn(
          "min-h-0 flex-1",
          isToolWorkspace ? "overflow-hidden" : "overflow-y-auto",
          !isToolWorkspace && "app-scroll",
        )}
      >
        <div
          ref={scrollContentRef}
          className={cn(isToolWorkspace && "h-full min-h-0")}
        >
          <AppRoutes />
          {isToolWorkspace ? null : <SiteFooter />}
        </div>
      </div>
    </div>
  );
}
