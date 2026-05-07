import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";

import { App } from "@/app/App";
import "@/styles/globals.css";

const rootElement = document.getElementById("root");

if (!rootElement) {
  throw new Error("No se encontro el elemento root para montar iHatePDF.");
}

createRoot(rootElement).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
);
