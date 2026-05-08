export function shouldUseSmoothPageScroll(pathname: string) {
  return !pathname.startsWith("/herramientas/");
}
