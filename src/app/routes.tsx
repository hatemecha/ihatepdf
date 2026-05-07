import { Route, Routes } from "react-router-dom";

import { HomePage } from "@/pages/HomePage";
import { NotFoundPage } from "@/pages/NotFoundPage";
import { ToolPage } from "@/pages/ToolPage";

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/herramientas/:slug" element={<ToolPage />} />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
