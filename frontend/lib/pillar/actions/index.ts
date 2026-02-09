/**
 * Pillar Action Definitions
 *
 * This file exports all action definitions for the Pillar Admin app.
 * These definitions are synced to the backend via CI/CD using:
 *
 *   npx pillar-sync --actions ./lib/pillar/actions/index.ts
 *
 * Handlers for these actions are registered separately in PillarSDKProvider.
 *
 * Type Inference:
 * - Data types are automatically inferred from the action's `type` field
 * - type: "navigate" → NavigateActionData { highlight_selector?, path? }
 * - type: "trigger_action" → TriggerActionData { action?, ... }
 * - type: "inline_ui" → InlineUIData { card_type, ... }
 * - Use `defaultData` only when you need custom fields beyond the base type
 *
 * Usage with typed onTask:
 * ```ts
 * import { usePillar } from "@pillar-ai/react";
 * import { actions } from "@/lib/pillar/actions";
 *
 * const { onTask } = usePillar<typeof actions>();
 *
 * // TypeScript infers data type from action's type field
 * onTask("open_knowledge", (data) => {
 *   nav("/knowledge", data.highlight_selector); // ✓ Typed!
 * });
 *
 * // Actions with custom defaultData get those types
 * onTask("add_new_source", (data) => {
 *   console.log(data.url); // ✓ Typed from defaultData!
 * });
 * ```
 */

import { analyticsActions } from "./analytics";
import { billingActions } from "./billing";
import { navigationActions } from "./navigation";
import { queryActions } from "./queries";
import { settingsActions } from "./settings";
import { sourcesActions } from "./sources";
import { supportActions } from "./support";
import { teamActions } from "./team";

/**
 * All action definitions combined.
 * This is the main export used by the sync CLI and for type inference.
 */
export const actions = {
  ...navigationActions,
  ...settingsActions,
  ...sourcesActions,
  ...analyticsActions,
  ...teamActions,
  ...billingActions,
  ...supportActions,
  ...queryActions,
};

/**
 * Type representing all available action names.
 * Use with usePillar<typeof actions>() for type-safe onTask handlers.
 */
export type Actions = typeof actions;

// Default export for CLI compatibility
export default actions;

// Re-export individual action groups for granular access
export {
  analyticsActions,
  billingActions,
  navigationActions,
  settingsActions,
  sourcesActions,
  supportActions,
  teamActions,
};

// Re-export custom data types for actions with extra fields
export type { AddSourceData } from "./sources";
