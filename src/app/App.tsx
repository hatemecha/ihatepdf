import { useEffect } from "react";
import { useLocation } from "react-router-dom";

import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { AppRoutes } from "@/app/routes";

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
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [location.pathname, location.hash]);

  return null;
}

export function App() {
  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <ScrollToHash />
      <div className="flex-1">
        <AppRoutes />
      </div>
      <SiteFooter />
    </div>
  );
}
