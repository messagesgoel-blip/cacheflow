/**
 * Plasmic Code Component Registration
 * 
 * Phase 2: Register safe, reusable UI components from Cacheflow's design system
 * for use in Plasmic Studio.
 * 
 * COMPONENT SELECTION CRITERIA:
 * - No auth/session/token dependencies
 * - No data-fetch side effects required for basic render
 * - Stable, simple props
 * - Presentation-only (no business logic)
 * 
 * FORBIDDEN PATTERNS (never expose to Plasmic):
 * - Vault tokens, provider credentials
 * - Session/user authentication state
 * - Internal IDs tied to private infrastructure
 * - Privileged callbacks (admin actions, mutations)
 * 
 * To add a new component:
 * 1. Ensure component meets selection criteria above
 * 2. Add import and registerComponent call below
 * 3. Document in docs/runbooks/plasmic-integration.md
 * 4. Add test in __tests__/registerCodeComponents.test.ts
 */

import registerComponent from "@plasmicapp/host/registerComponent";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Spinner } from "@/components/ui/Spinner";

// Guard against duplicate registration (HMR, SSR, etc.)
const REGISTER_FLAG = "__CACHEFLOW_PLASMIC_REGISTERED__";
if ((globalThis as any)[REGISTER_FLAG]) {
  // Already registered in this process
} else {
  // Type helpers for Plasmic component registration
  // Using 'any' for type system since this is a blackbox integration
  type PlasmicPropType = any;

/**
 * Button component registration
 * Safe props: variant, size, className, standard button attributes
 */
registerComponent(Button, {
  name: "CacheflowButton",
  displayName: "Cacheflow Button",
  importPath: "@/components/ui/Button",
  props: {
    variant: {
      type: "choice" as PlasmicPropType,
      options: ["default", "secondary", "outline", "ghost", "destructive", "link"],
      defaultValue: "default",
    },
    size: {
      type: "choice" as PlasmicPropType,
      options: ["default", "sm", "lg", "icon"],
      defaultValue: "default",
    },
    children: {
      type: "string" as PlasmicPropType,
      defaultValue: "Button",
    },
    disabled: {
      type: "boolean" as PlasmicPropType,
      defaultValue: false,
    },
    className: {
      type: "string" as PlasmicPropType,
      defaultValue: "",
    },
  },
});

/**
 * Badge component registration
 * Safe props: variant, className, standard div attributes
 */
registerComponent(Badge, {
  name: "CacheflowBadge",
  displayName: "Cacheflow Badge",
  importPath: "@/components/ui/Badge",
  props: {
    variant: {
      type: "choice" as PlasmicPropType,
      options: ["default", "secondary", "success", "warning", "destructive", "outline"],
      defaultValue: "default",
    },
    children: {
      type: "string" as PlasmicPropType,
      defaultValue: "Badge",
    },
    className: {
      type: "string" as PlasmicPropType,
      defaultValue: "",
    },
  },
});

/**
 * Spinner component registration
 * Safe props: size, className
 */
registerComponent(Spinner, {
  name: "CacheflowSpinner",
  displayName: "Cacheflow Spinner",
  importPath: "@/components/ui/Spinner",
  props: {
    size: {
      type: "choice" as PlasmicPropType,
      options: ["sm", "md", "lg"],
      defaultValue: "md",
    },
    className: {
      type: "string" as PlasmicPropType,
      defaultValue: "",
    },
  },
});

  // Mark as registered to prevent duplicate registration
  (globalThis as any)[REGISTER_FLAG] = true;

  // Only log in non-production
  if (process.env.NODE_ENV !== "production") {
    console.log("[Plasmic] Registered code components: CacheflowButton, CacheflowBadge, CacheflowSpinner");
  }
}
