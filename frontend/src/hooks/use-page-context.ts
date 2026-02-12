"use client";

import { usePathname } from "next/navigation";
import { useMemo } from "react";
import type { SpotlightContext } from "@/types";

/**
 * Extracts page context from the current URL for the Spotlight AI.
 */
export function usePageContext(): SpotlightContext {
  const pathname = usePathname();

  return useMemo(() => {
    const segments = pathname.split("/").filter(Boolean);
    const context: SpotlightContext = {
      current_path: pathname,
      current_page_type: "unknown",
    };

    if (segments.length === 0 || segments[0] === "dashboard") {
      context.current_page_type = "dashboard";
    } else if (segments[0] === "projects") {
      if (segments.length >= 2) {
        context.current_page_type = "project_detail";
        context.current_entity_id = segments[1];
      } else {
        context.current_page_type = "projects";
      }
    } else if (segments[0] === "workspace") {
      if (segments.length >= 2) {
        context.current_page_type = "document";
        context.current_entity_id = segments[1];
      } else {
        context.current_page_type = "workspace";
      }
    } else if (segments[0] === "board") {
      context.current_page_type = "board";
    } else if (segments[0] === "profile") {
      context.current_page_type = "profile";
    }

    return context;
  }, [pathname]);
}
