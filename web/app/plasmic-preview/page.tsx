/**
 * Plasmic Preview Route
 * 
 * This route renders the generated Plasmic content for preview/development purposes.
 * It is NOT meant to replace the production homepage.
 * 
 * Generated files (DO NOT EDIT manually):
 * - web/components/plasmic/blank_project/PlasmicHomepage.tsx
 * - web/components/plasmic/blank_project/PlasmicHomepageServer.tsx
 * 
 * To sync with Plasmic Studio:
 *   cd web && HOME=/home/sanjay npm run plasmic:sync
 */
"use client";

import * as React from "react";
import { PageParamsProvider } from "@plasmicapp/host";
import {
  PlasmicHomepage,
  DefaultHomepageProps
} from "@/components/plasmic/blank_project/PlasmicHomepage";

export default function PlasmicPreviewPage() {
  return (
    <div style={{ minHeight: "100vh" }}>
      <PageParamsProvider
        route="/plasmic-preview"
        params={{}}
        query={{}}
      >
        <PlasmicHomepage />
      </PageParamsProvider>
    </div>
  );
}
