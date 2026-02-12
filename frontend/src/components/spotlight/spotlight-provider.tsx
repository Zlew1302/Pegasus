"use client";

import { SpotlightOverlay } from "./spotlight-overlay";

/**
 * Client-side wrapper to mount SpotlightOverlay in the server-component root layout.
 */
export function SpotlightProvider() {
  return <SpotlightOverlay />;
}
