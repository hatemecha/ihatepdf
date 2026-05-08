import { useCallback, useEffect, useRef, useState } from "react";

import {
  DEFAULT_PRESET,
  PAGE_PRESETS,
  type LayoutImageAsset,
  type LayoutImageElement,
  type LayoutPage,
  type PagePresetId,
} from "./layoutTypes";

function createId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 8)}`;
}

function createEmptyPage(
  presetId: PagePresetId = DEFAULT_PRESET.id,
): LayoutPage {
  const preset =
    PAGE_PRESETS.find((current) => current.id === presetId) ?? DEFAULT_PRESET;
  return {
    id: createId("page"),
    presetId: preset.id,
    width: preset.width,
    height: preset.height,
    elements: [],
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function fitElementToPage(
  page: LayoutPage,
  asset: LayoutImageAsset,
): LayoutImageElement {
  const maxWidth = page.width * 0.7;
  const maxHeight = page.height * 0.7;
  const scale = Math.min(
    maxWidth / asset.naturalWidth,
    maxHeight / asset.naturalHeight,
    1,
  );
  const width = asset.naturalWidth * scale;
  const height = asset.naturalHeight * scale;

  return {
    id: createId("element"),
    imageId: asset.id,
    x: (page.width - width) / 2,
    y: (page.height - height) / 2,
    width,
    height,
    rotation: 0,
  };
}

export interface LayoutEditorState {
  pages: LayoutPage[];
  images: LayoutImageAsset[];
  activePageId: string;
  selectedElementId: string | null;
}

export function useLayoutEditor() {
  const [state, setState] = useState<LayoutEditorState>(() => {
    const firstPage = createEmptyPage();
    return {
      pages: [firstPage],
      images: [],
      activePageId: firstPage.id,
      selectedElementId: null,
    };
  });

  const previewUrlsRef = useRef<string[]>([]);

  useEffect(() => {
    previewUrlsRef.current = state.images.map((image) => image.previewUrl);
  }, [state.images]);

  useEffect(() => {
    return () => {
      previewUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
    };
  }, []);

  const activePage =
    state.pages.find((page) => page.id === state.activePageId) ??
    state.pages[0];
  const selectedElement = activePage.elements.find(
    (element) => element.id === state.selectedElementId,
  );

  const setActivePage = useCallback((pageId: string) => {
    setState((current) => ({
      ...current,
      activePageId: pageId,
      selectedElementId: null,
    }));
  }, []);

  const addPage = useCallback((presetId: PagePresetId) => {
    const nextPage = createEmptyPage(presetId);
    setState((current) => ({
      ...current,
      pages: [...current.pages, nextPage],
      activePageId: nextPage.id,
      selectedElementId: null,
    }));
  }, []);

  const removePage = useCallback((pageId: string) => {
    setState((current) => {
      if (current.pages.length <= 1) {
        return current;
      }

      const filteredPages = current.pages.filter((page) => page.id !== pageId);
      const nextActiveId =
        current.activePageId === pageId
          ? filteredPages[0].id
          : current.activePageId;

      return {
        ...current,
        pages: filteredPages,
        activePageId: nextActiveId,
        selectedElementId: null,
      };
    });
  }, []);

  const setPagePreset = useCallback(
    (pageId: string, presetId: PagePresetId) => {
      const preset =
        PAGE_PRESETS.find((current) => current.id === presetId) ??
        DEFAULT_PRESET;
      setState((current) => ({
        ...current,
        pages: current.pages.map((page) =>
          page.id === pageId
            ? {
                ...page,
                presetId: preset.id,
                width: preset.width,
                height: preset.height,
              }
            : page,
        ),
      }));
    },
    [],
  );

  const addImageAssets = useCallback((assets: LayoutImageAsset[]) => {
    setState((current) => ({
      ...current,
      images: [...current.images, ...assets],
    }));
  }, []);

  const removeImageAsset = useCallback((imageId: string) => {
    setState((current) => {
      const removedImage = current.images.find((image) => image.id === imageId);
      if (removedImage) {
        URL.revokeObjectURL(removedImage.previewUrl);
      }

      return {
        ...current,
        images: current.images.filter((image) => image.id !== imageId),
        pages: current.pages.map((page) => ({
          ...page,
          elements: page.elements.filter(
            (element) => element.imageId !== imageId,
          ),
        })),
        selectedElementId: null,
      };
    });
  }, []);

  const placeImageOnActivePage = useCallback((imageId: string) => {
    setState((current) => {
      const asset = current.images.find((image) => image.id === imageId);
      if (!asset) {
        return current;
      }

      const targetPage =
        current.pages.find((page) => page.id === current.activePageId) ??
        current.pages[0];
      const newElement = fitElementToPage(targetPage, asset);

      return {
        ...current,
        pages: current.pages.map((page) =>
          page.id === targetPage.id
            ? { ...page, elements: [...page.elements, newElement] }
            : page,
        ),
        selectedElementId: newElement.id,
      };
    });
  }, []);

  const placeImageOnActivePageAt = useCallback(
    (imageId: string, pageX: number, pageY: number) => {
      setState((current) => {
        const asset = current.images.find((image) => image.id === imageId);
        if (!asset) {
          return current;
        }

        const targetPage =
          current.pages.find((page) => page.id === current.activePageId) ??
          current.pages[0];
        const base = fitElementToPage(targetPage, asset);
        let x = pageX - base.width / 2;
        let y = pageY - base.height / 2;
        x = clamp(x, 0, Math.max(0, targetPage.width - base.width));
        y = clamp(y, 0, Math.max(0, targetPage.height - base.height));
        const placed: LayoutImageElement = { ...base, x, y };

        return {
          ...current,
          pages: current.pages.map((page) =>
            page.id === targetPage.id
              ? { ...page, elements: [...page.elements, placed] }
              : page,
          ),
          selectedElementId: placed.id,
        };
      });
    },
    [],
  );

  const updateElement = useCallback(
    (
      elementId: string,
      patch: Partial<Omit<LayoutImageElement, "id" | "imageId">>,
    ) => {
      setState((current) => ({
        ...current,
        pages: current.pages.map((page) =>
          page.id === current.activePageId
            ? {
                ...page,
                elements: page.elements.map((element) =>
                  element.id === elementId ? { ...element, ...patch } : element,
                ),
              }
            : page,
        ),
      }));
    },
    [],
  );

  const removeElement = useCallback((elementId: string) => {
    setState((current) => ({
      ...current,
      pages: current.pages.map((page) =>
        page.id === current.activePageId
          ? {
              ...page,
              elements: page.elements.filter(
                (element) => element.id !== elementId,
              ),
            }
          : page,
      ),
      selectedElementId:
        current.selectedElementId === elementId
          ? null
          : current.selectedElementId,
    }));
  }, []);

  const duplicateElement = useCallback((elementId: string) => {
    setState((current) => {
      const targetPage = current.pages.find(
        (page) => page.id === current.activePageId,
      );
      if (!targetPage) {
        return current;
      }

      const sourceElement = targetPage.elements.find(
        (element) => element.id === elementId,
      );
      if (!sourceElement) {
        return current;
      }

      const offset = 24;
      const duplicated: LayoutImageElement = {
        ...sourceElement,
        id: createId("element"),
        x: Math.min(
          targetPage.width - sourceElement.width,
          sourceElement.x + offset,
        ),
        y: Math.min(
          targetPage.height - sourceElement.height,
          sourceElement.y + offset,
        ),
      };

      return {
        ...current,
        pages: current.pages.map((page) =>
          page.id === targetPage.id
            ? { ...page, elements: [...page.elements, duplicated] }
            : page,
        ),
        selectedElementId: duplicated.id,
      };
    });
  }, []);

  const moveElementInZOrder = useCallback(
    (
      elementId: string,
      direction: "front" | "forward" | "backward" | "back",
    ) => {
      setState((current) => ({
        ...current,
        pages: current.pages.map((page) => {
          if (page.id !== current.activePageId) {
            return page;
          }

          const index = page.elements.findIndex(
            (element) => element.id === elementId,
          );
          if (index < 0) {
            return page;
          }

          const nextElements = [...page.elements];
          const [moved] = nextElements.splice(index, 1);

          switch (direction) {
            case "front":
              nextElements.push(moved);
              break;
            case "back":
              nextElements.unshift(moved);
              break;
            case "forward": {
              const targetIndex = Math.min(index + 1, nextElements.length);
              nextElements.splice(targetIndex, 0, moved);
              break;
            }
            case "backward": {
              const targetIndex = Math.max(index - 1, 0);
              nextElements.splice(targetIndex, 0, moved);
              break;
            }
          }

          return { ...page, elements: nextElements };
        }),
      }));
    },
    [],
  );

  const selectElement = useCallback((elementId: string | null) => {
    setState((current) => ({ ...current, selectedElementId: elementId }));
  }, []);

  return {
    state,
    activePage,
    selectedElement,
    setActivePage,
    addPage,
    removePage,
    setPagePreset,
    addImageAssets,
    removeImageAsset,
    placeImageOnActivePage,
    placeImageOnActivePageAt,
    updateElement,
    removeElement,
    duplicateElement,
    moveElementInZOrder,
    selectElement,
  };
}
