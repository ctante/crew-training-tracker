"use client";

import { ghostButton } from "@/components/ui";

export function PrintButton() {
  return (
    <button type="button" className={ghostButton} onClick={() => window.print()}>
      Print
    </button>
  );
}
