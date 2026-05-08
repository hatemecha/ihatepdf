import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type DragEvent,
  type KeyboardEvent,
  type PointerEvent,
} from "react";

import { cn } from "@/lib/utils";

import {
  CENTER_SNAP_THRESHOLD,
  LAYOUT_ASSET_DRAG_MIME,
  SNAP_GRID_SIZE,
  type LayoutImageAsset,
  type LayoutImageElement,
  type LayoutPage,
} from "./layoutTypes";

interface InteractivePageProps {
  page: LayoutPage;
  images: LayoutImageAsset[];
  selectedElementId: string | null;
  snapEnabled: boolean;
  displayScale: number;
  onSelectElement: (elementId: string | null) => void;
  onUpdateElement: (
    elementId: string,
    patch: Partial<Omit<LayoutImageElement, "id" | "imageId">>,
  ) => void;
  /** When set, dropping a library image (native DnD) places it at these page coordinates (center of the element). */
  onDropImageFromLibrary?: (
    imageId: string,
    pageX: number,
    pageY: number,
  ) => void;
}

type ResizeCorner = "tl" | "tr" | "bl" | "br";

interface DragState {
  pointerId: number;
  startX: number;
  startY: number;
  initial: LayoutImageElement;
  mode:
    | { kind: "move" }
    | { kind: "resize"; corner: ResizeCorner }
    | { kind: "rotate" };
}

interface SnapGuide {
  orientation: "vertical" | "horizontal";
  position: number;
}

const MIN_DIMENSION = 12;

function snapValueToGrid(value: number): number {
  return Math.round(value / SNAP_GRID_SIZE) * SNAP_GRID_SIZE;
}

function getResizeAnchorSign(corner: ResizeCorner): { sx: -1 | 1; sy: -1 | 1 } {
  switch (corner) {
    case "tl":
      return { sx: -1, sy: -1 };
    case "tr":
      return { sx: 1, sy: -1 };
    case "bl":
      return { sx: -1, sy: 1 };
    case "br":
      return { sx: 1, sy: 1 };
  }
}

export function InteractivePage({
  page,
  images,
  selectedElementId,
  snapEnabled,
  displayScale,
  onSelectElement,
  onUpdateElement,
  onDropImageFromLibrary,
}: InteractivePageProps) {
  const pageRef = useRef<HTMLDivElement>(null);
  const dragStateRef = useRef<DragState | null>(null);
  const [activeGuides, setActiveGuides] = useState<SnapGuide[]>([]);

  const imagesById = useMemo(() => {
    const map = new Map<string, LayoutImageAsset>();
    for (const image of images) {
      map.set(image.id, image);
    }
    return map;
  }, [images]);

  function getPagePointFromClient(clientX: number, clientY: number): {
    x: number;
    y: number;
  } {
    const pageElement = pageRef.current;
    if (!pageElement) {
      return { x: 0, y: 0 };
    }

    const rect = pageElement.getBoundingClientRect();
    return {
      x: (clientX - rect.left) / displayScale,
      y: (clientY - rect.top) / displayScale,
    };
  }

  function getPagePointFromEvent(event: PointerEvent): {
    x: number;
    y: number;
  } {
    return getPagePointFromClient(event.clientX, event.clientY);
  }

  function handlePageDragOver(event: DragEvent<HTMLDivElement>) {
    if (!onDropImageFromLibrary) {
      return;
    }
    if (!event.dataTransfer.types.includes(LAYOUT_ASSET_DRAG_MIME)) {
      return;
    }
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
  }

  function handlePageDrop(event: DragEvent<HTMLDivElement>) {
    if (!onDropImageFromLibrary) {
      return;
    }
    const raw = event.dataTransfer.getData(LAYOUT_ASSET_DRAG_MIME);
    if (!raw) {
      return;
    }
    event.preventDefault();
    const { x, y } = getPagePointFromClient(event.clientX, event.clientY);
    onDropImageFromLibrary(raw, x, y);
  }

  function clearDragState(target: Element | null, pointerId: number | null) {
    if (target && pointerId !== null && "releasePointerCapture" in target) {
      try {
        (target as Element).releasePointerCapture(pointerId);
      } catch {
        // ignore release failures (pointer may have been lost)
      }
    }
    dragStateRef.current = null;
    setActiveGuides([]);
  }

  function handleBackgroundPointerDown(event: PointerEvent<HTMLDivElement>) {
    if (event.target === event.currentTarget) {
      onSelectElement(null);
    }
  }

  function startMove(event: PointerEvent, element: LayoutImageElement) {
    const point = getPagePointFromEvent(event);
    dragStateRef.current = {
      pointerId: event.pointerId,
      startX: point.x,
      startY: point.y,
      initial: { ...element },
      mode: { kind: "move" },
    };
    (event.currentTarget as Element).setPointerCapture(event.pointerId);
    onSelectElement(element.id);
    event.stopPropagation();
  }

  function startResize(
    event: PointerEvent,
    element: LayoutImageElement,
    corner: ResizeCorner,
  ) {
    const point = getPagePointFromEvent(event);
    dragStateRef.current = {
      pointerId: event.pointerId,
      startX: point.x,
      startY: point.y,
      initial: { ...element },
      mode: { kind: "resize", corner },
    };
    (event.currentTarget as Element).setPointerCapture(event.pointerId);
    event.stopPropagation();
  }

  function startRotate(event: PointerEvent, element: LayoutImageElement) {
    const point = getPagePointFromEvent(event);
    dragStateRef.current = {
      pointerId: event.pointerId,
      startX: point.x,
      startY: point.y,
      initial: { ...element },
      mode: { kind: "rotate" },
    };
    (event.currentTarget as Element).setPointerCapture(event.pointerId);
    event.stopPropagation();
  }

  function handlePointerMove(event: PointerEvent) {
    const dragState = dragStateRef.current;
    if (!dragState || dragState.pointerId !== event.pointerId) {
      return;
    }

    const point = getPagePointFromEvent(event);
    const deltaX = point.x - dragState.startX;
    const deltaY = point.y - dragState.startY;
    const initial = dragState.initial;

    if (dragState.mode.kind === "move") {
      let nextX = initial.x + deltaX;
      let nextY = initial.y + deltaY;
      const guides: SnapGuide[] = [];

      if (snapEnabled && !event.altKey) {
        nextX = snapValueToGrid(nextX);
        nextY = snapValueToGrid(nextY);

        const elementCenterX = nextX + initial.width / 2;
        const elementCenterY = nextY + initial.height / 2;
        const pageCenterX = page.width / 2;
        const pageCenterY = page.height / 2;

        if (Math.abs(elementCenterX - pageCenterX) < CENTER_SNAP_THRESHOLD) {
          nextX = pageCenterX - initial.width / 2;
          guides.push({ orientation: "vertical", position: pageCenterX });
        }
        if (Math.abs(elementCenterY - pageCenterY) < CENTER_SNAP_THRESHOLD) {
          nextY = pageCenterY - initial.height / 2;
          guides.push({ orientation: "horizontal", position: pageCenterY });
        }
      }

      onUpdateElement(initial.id, { x: nextX, y: nextY });
      setActiveGuides(guides);
      return;
    }

    if (dragState.mode.kind === "resize") {
      const corner = dragState.mode.corner;
      const { sx, sy } = getResizeAnchorSign(corner);
      const theta = (initial.rotation * Math.PI) / 180;
      const cosTheta = Math.cos(theta);
      const sinTheta = Math.sin(theta);

      const initialCenterX = initial.x + initial.width / 2;
      const initialCenterY = initial.y + initial.height / 2;

      const anchorX =
        initialCenterX -
        sx * (initial.width / 2) * cosTheta +
        sy * (initial.height / 2) * sinTheta;
      const anchorY =
        initialCenterY -
        sx * (initial.width / 2) * sinTheta -
        sy * (initial.height / 2) * cosTheta;

      const offsetX = point.x - anchorX;
      const offsetY = point.y - anchorY;
      const localDx = offsetX * cosTheta + offsetY * sinTheta;
      const localDy = -offsetX * sinTheta + offsetY * cosTheta;

      let newWidth = Math.max(MIN_DIMENSION, Math.abs(localDx));
      let newHeight = Math.max(MIN_DIMENSION, Math.abs(localDy));

      if (event.shiftKey) {
        const aspect = initial.width / initial.height;
        if (newWidth / newHeight > aspect) {
          newHeight = newWidth / aspect;
        } else {
          newWidth = newHeight * aspect;
        }
      }

      const signedHalfX = sx * (newWidth / 2);
      const signedHalfY = sy * (newHeight / 2);

      const newCenterX =
        anchorX + signedHalfX * cosTheta - signedHalfY * sinTheta;
      const newCenterY =
        anchorY + signedHalfX * sinTheta + signedHalfY * cosTheta;

      const newX = newCenterX - newWidth / 2;
      const newY = newCenterY - newHeight / 2;

      onUpdateElement(initial.id, {
        x: newX,
        y: newY,
        width: newWidth,
        height: newHeight,
      });
      return;
    }

    if (dragState.mode.kind === "rotate") {
      const centerX = initial.x + initial.width / 2;
      const centerY = initial.y + initial.height / 2;

      const initialAngle = Math.atan2(
        dragState.startY - centerY,
        dragState.startX - centerX,
      );
      const currentAngle = Math.atan2(point.y - centerY, point.x - centerX);
      const deltaDegrees = ((currentAngle - initialAngle) * 180) / Math.PI;

      let nextRotation = initial.rotation + deltaDegrees;

      if (event.shiftKey) {
        nextRotation = Math.round(nextRotation / 15) * 15;
      }

      nextRotation = ((nextRotation % 360) + 360) % 360;
      if (nextRotation > 180) {
        nextRotation -= 360;
      }

      onUpdateElement(initial.id, { rotation: nextRotation });
      return;
    }
  }

  function handlePointerEnd(event: PointerEvent) {
    if (
      !dragStateRef.current ||
      dragStateRef.current.pointerId !== event.pointerId
    ) {
      return;
    }
    clearDragState(event.currentTarget as Element, event.pointerId);
  }

  function handleElementKeyDown(
    event: KeyboardEvent<HTMLDivElement>,
    element: LayoutImageElement,
  ) {
    const step = event.shiftKey ? SNAP_GRID_SIZE : 1;
    const movementByKey: Partial<Record<string, { x: number; y: number }>> = {
      ArrowDown: { x: 0, y: step },
      ArrowLeft: { x: -step, y: 0 },
      ArrowRight: { x: step, y: 0 },
      ArrowUp: { x: 0, y: -step },
    };
    const movement = movementByKey[event.key];

    if (!movement) {
      return;
    }

    event.preventDefault();
    onSelectElement(element.id);
    onUpdateElement(element.id, {
      x: element.x + movement.x,
      y: element.y + movement.y,
    });
  }

  useEffect(() => {
    return () => {
      dragStateRef.current = null;
    };
  }, []);

  const sortedElements = page.elements;

  return (
    <div
      ref={pageRef}
      className="relative shadow-[0_12px_28px_-12px_rgba(0,0,0,0.4)] outline outline-1 outline-border"
      style={{
        width: page.width * displayScale,
        height: page.height * displayScale,
        background: "#ffffff",
      }}
      onPointerDown={handleBackgroundPointerDown}
      onDragOver={handlePageDragOver}
      onDrop={handlePageDrop}
    >
      {sortedElements.map((element) => {
        const asset = imagesById.get(element.imageId);
        if (!asset) {
          return null;
        }

        const isSelected = element.id === selectedElementId;
        const left = element.x * displayScale;
        const top = element.y * displayScale;
        const width = element.width * displayScale;
        const height = element.height * displayScale;

        return (
          <div
            key={element.id}
            className="absolute select-none touch-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
            role="group"
            tabIndex={0}
            aria-label={`Seleccionar ${asset.name}. Usa las flechas para moverlo.`}
            style={{
              left,
              top,
              width,
              height,
              transform: `rotate(${element.rotation}deg)`,
              transformOrigin: "center center",
              cursor: isSelected ? "move" : "pointer",
            }}
            onPointerDown={(event) => startMove(event, element)}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerEnd}
            onPointerCancel={handlePointerEnd}
            onFocus={() => onSelectElement(element.id)}
            onKeyDown={(event) => handleElementKeyDown(event, element)}
          >
            <img
              src={asset.previewUrl}
              alt={asset.name}
              draggable={false}
              className={cn(
                "block h-full w-full select-none object-fill",
                isSelected ? "outline outline-2 outline-brand" : null,
              )}
            />

            {isSelected ? (
              <>
                <div
                  className="absolute left-1/2 -top-10 h-9 w-px"
                  style={{ background: "var(--brand)" }}
                />
                <button
                  type="button"
                  aria-label="Rotar"
                  className="absolute left-1/2 -top-10 -translate-x-1/2 flex size-7 items-center justify-center rounded-full border border-brand bg-background text-brand-foreground shadow"
                  style={{ cursor: "grab", touchAction: "none" }}
                  onPointerDown={(event) => startRotate(event, element)}
                  onPointerMove={handlePointerMove}
                  onPointerUp={handlePointerEnd}
                  onPointerCancel={handlePointerEnd}
                >
                  <svg
                    viewBox="0 0 24 24"
                    width="14"
                    height="14"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M3 12a9 9 0 1 0 3-6.7" />
                    <path d="M3 4v5h5" />
                  </svg>
                </button>

                {(["tl", "tr", "bl", "br"] as ResizeCorner[]).map((corner) => {
                  const positionStyles: Record<ResizeCorner, string> = {
                    tl: "-top-1.5 -left-1.5 cursor-nwse-resize",
                    tr: "-top-1.5 -right-1.5 cursor-nesw-resize",
                    bl: "-bottom-1.5 -left-1.5 cursor-nesw-resize",
                    br: "-bottom-1.5 -right-1.5 cursor-nwse-resize",
                  };
                  return (
                    <div
                      key={corner}
                      role="button"
                      aria-label={`Redimensionar ${corner}`}
                      tabIndex={-1}
                      className={cn(
                        "absolute size-3 rounded-sm border border-brand bg-background shadow",
                        positionStyles[corner],
                      )}
                      style={{ touchAction: "none" }}
                      onPointerDown={(event) =>
                        startResize(event, element, corner)
                      }
                      onPointerMove={handlePointerMove}
                      onPointerUp={handlePointerEnd}
                      onPointerCancel={handlePointerEnd}
                    />
                  );
                })}
              </>
            ) : null}
          </div>
        );
      })}

      {activeGuides.map((guide, index) => (
        <div
          key={`${guide.orientation}-${index}`}
          className="pointer-events-none absolute"
          style={
            guide.orientation === "vertical"
              ? {
                  top: 0,
                  bottom: 0,
                  left: guide.position * displayScale,
                  width: 1,
                  background: "var(--brand)",
                  opacity: 0.6,
                }
              : {
                  left: 0,
                  right: 0,
                  top: guide.position * displayScale,
                  height: 1,
                  background: "var(--brand)",
                  opacity: 0.6,
                }
          }
        />
      ))}
    </div>
  );
}
