import { useEffect } from "react";
import { useLocation } from "react-router-dom";

import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { AppRoutes } from "@/app/routes";
import { cn } from "@/lib/utils";

function ScrollToHash() {
  const location = useLocation();

  useEffect(() => {
    if (location.hash) {
      const id = location.hash.replace("#", "");
      const node = document.getElementById(id);
      if (node) {
        node.scrollIntoView({ behavior: "smooth", block: "start" });
        return;
      }
    }
    if (!location.hash) {
      const scrollTarget = document.scrollingElement ?? document.documentElement;
      scrollTarget.scrollTop = 0;
    }
  }, [location.pathname, location.hash]);

  return null;
}

export function App() {
  const location = useLocation();
  const isToolWorkspace = location.pathname.startsWith("/herramientas/");

  return (
    <div className="flex h-dvh flex-col overflow-hidden">
      <SiteHeader />
      <ScrollToHash />
      <div
        className={cn(
          "min-h-0 flex-1",
          isToolWorkspace ? "overflow-hidden" : "overflow-y-auto",
        )}
      >
        <AppRoutes />
        {isToolWorkspace ? null : <SiteFooter />}
      </div>
    </div>
  );
}
