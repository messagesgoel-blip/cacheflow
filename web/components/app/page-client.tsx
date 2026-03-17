"use client";

import * as React from "react";
import {
  PlasmicHomepage,
  DefaultHomepageProps
} from "../plasmic/blank_project/PlasmicHomepage"; // plasmic-import: xZNX0s_Ctkdu/render

export function ClientHomepage(props: DefaultHomepageProps) {
  return <PlasmicHomepage {...props} />;
}
