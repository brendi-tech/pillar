import { useCallback, useMemo, useState } from "react";
import type {
  Agent,
  AgentMCPSourceConfig,
  AgentOpenAPISourceConfig,
} from "@/types/agent";
import { CLIENT_SIDE_CHANNELS } from "@/types/agent";
import type { MCPToolSource } from "@/types/mcpSource";
import type { OpenAPIToolSource } from "@/types/openAPISource";
import type { ToolItem, SelectionState, OverrideField } from "./ToolsTab.types";
import { CHANNELS_WITH_CONTEXT } from "./ToolsTab.types";

interface UseToolsStateParams {
  agent: Agent;
  onChange: (updates: Partial<Agent>) => void;
  tools: ToolItem[];
  mcpSources: MCPToolSource[];
  openAPISources: OpenAPIToolSource[];
}

export function useToolsState({
  agent,
  onChange,
  tools,
  mcpSources,
  openAPISources,
}: UseToolsStateParams) {
  const [searchQuery, setSearchQuery] = useState("");
  const [collapsedSources, setCollapsedSources] = useState<Set<string>>(
    () => new Set()
  );

  const supportsClientSide = CLIENT_SIDE_CHANNELS.includes(agent.channel);
  const showContextColumns = CHANNELS_WITH_CONTEXT.includes(
    agent.channel as (typeof CHANNELS_WITH_CONTEXT)[number]
  );
  const restrictions = agent.tool_context_restrictions || {};

  const isChannelCompatible = useCallback(
    (t: ToolItem) => {
      if (!supportsClientSide && t.tool_type === "client_side") return false;
      return (
        !t.channel_compatibility?.length ||
        t.channel_compatibility.includes("*") ||
        t.channel_compatibility.includes(agent.channel)
      );
    },
    [supportsClientSide, agent.channel]
  );

  const compatibleTools = useMemo(
    () => tools.filter(isChannelCompatible),
    [tools, isChannelCompatible]
  );
  const incompatibleTools = useMemo(
    () => tools.filter((t) => !isChannelCompatible(t)),
    [tools, isChannelCompatible]
  );

  const serverTools = useMemo(
    () => compatibleTools.filter((t) => t.tool_type === "server_side"),
    [compatibleTools]
  );
  const clientTools = useMemo(
    () => compatibleTools.filter((t) => t.tool_type === "client_side"),
    [compatibleTools]
  );
  const untypedTools = useMemo(
    () => compatibleTools.filter((t) => !t.tool_type),
    [compatibleTools]
  );

  // --- SDK tool scope ---

  const scope = agent.tool_scope || "all";

  const enabledIds = useMemo((): Set<string> => {
    if (scope === "all") return new Set(compatibleTools.map((t) => t.id));
    if (scope === "none") return new Set();
    if (scope === "allowed") return new Set(agent.tool_allowance_ids || []);
    if (scope === "restricted") {
      const blocked = new Set(agent.tool_restriction_ids || []);
      return new Set(
        compatibleTools.filter((t) => !blocked.has(t.id)).map((t) => t.id)
      );
    }
    if (scope === "all_server_side")
      return new Set(
        compatibleTools
          .filter((t) => t.tool_type === "server_side")
          .map((t) => t.id)
      );
    if (scope === "all_client_side")
      return new Set(
        compatibleTools
          .filter((t) => t.tool_type === "client_side")
          .map((t) => t.id)
      );
    return new Set(compatibleTools.map((t) => t.id));
  }, [scope, compatibleTools, agent.tool_allowance_ids, agent.tool_restriction_ids]);

  const emitNormalized = useCallback(
    (newIds: string[], newRestrictions: Record<string, string[]>) => {
      const allEnabled =
        newIds.length === compatibleTools.length &&
        compatibleTools.every((t) => newIds.includes(t.id));
      const noRestrictions = Object.keys(newRestrictions).length === 0;

      if (allEnabled && noRestrictions) {
        onChange({
          tool_scope: "all",
          tool_allowance_ids: [],
          tool_restriction_ids: [],
          tool_context_restrictions: {},
        });
      } else if (newIds.length === 0) {
        onChange({
          tool_scope: "none",
          tool_allowance_ids: [],
          tool_restriction_ids: [],
        });
      } else {
        onChange({
          tool_scope: "allowed",
          tool_allowance_ids: newIds,
          tool_restriction_ids: [],
        });
      }
    },
    [compatibleTools, onChange]
  );

  const handleToolToggle = useCallback(
    (toolId: string, enabled: boolean) => {
      const isAll =
        enabledIds.size === compatibleTools.length &&
        compatibleTools.every((t) => enabledIds.has(t.id));
      const isNone = enabledIds.size === 0;

      if (isAll && !enabled) {
        onChange({
          tool_scope: "allowed",
          tool_allowance_ids: compatibleTools
            .filter((t) => t.id !== toolId)
            .map((t) => t.id),
          tool_restriction_ids: [],
        });
        return;
      }
      if (isNone && enabled) {
        onChange({
          tool_scope: "allowed",
          tool_allowance_ids: [toolId],
          tool_restriction_ids: [],
        });
        return;
      }
      const currentIds = [...enabledIds];
      const newIds = enabled
        ? [...currentIds, toolId]
        : currentIds.filter((id) => id !== toolId);
      emitNormalized(newIds, restrictions);
    },
    [enabledIds, compatibleTools, restrictions, onChange, emitNormalized]
  );

  // --- Section select all ---

  const handleSdkSectionSelectAll = useCallback(
    (sectionTools: ToolItem[], selectAll: boolean) => {
      const sectionIds = new Set(sectionTools.map((t) => t.id));
      let newIds: string[];

      if (selectAll) {
        newIds = [
          ...new Set([...enabledIds, ...sectionIds]),
        ];
      } else {
        newIds = [...enabledIds].filter((id) => !sectionIds.has(id));
      }
      emitNormalized(newIds, restrictions);
    },
    [enabledIds, restrictions, emitNormalized]
  );

  const getSdkSectionSelectionState = useCallback(
    (sectionTools: ToolItem[]): SelectionState => {
      if (sectionTools.length === 0) return "none";
      const enabledCount = sectionTools.filter((t) =>
        enabledIds.has(t.id)
      ).length;
      if (enabledCount === 0) return "none";
      if (enabledCount === sectionTools.length) return "all";
      return "some";
    },
    [enabledIds]
  );

  // --- Context restrictions (DMs / Public) ---

  const isContextChecked = useCallback(
    (toolName: string, context: "private" | "public") => {
      const allowed = restrictions[toolName];
      if (!allowed) return true;
      return allowed.includes(context);
    },
    [restrictions]
  );

  const handleContextToggle = useCallback(
    (toolName: string, toolId: string, context: "private" | "public", checked: boolean) => {
      const other = context === "private" ? "public" : "private";
      const currentAllowed = restrictions[toolName];
      const otherChecked = currentAllowed
        ? currentAllowed.includes(other)
        : true;
      const isEnabled = enabledIds.has(toolId);

      if (checked && !isEnabled) {
        handleToolToggle(toolId, true);
        const newRestrictions = { ...restrictions, [toolName]: [context] };
        onChange({ tool_context_restrictions: newRestrictions });
        return;
      }

      if (!checked && !otherChecked) {
        const newRestrictions = { ...restrictions };
        delete newRestrictions[toolName];
        handleToolToggle(toolId, false);
        onChange({ tool_context_restrictions: newRestrictions });
        return;
      }

      const newRestrictions = { ...restrictions };

      if (
        checked &&
        (currentAllowed ? currentAllowed.includes(other) : true)
      ) {
        delete newRestrictions[toolName];
      } else if (checked) {
        newRestrictions[toolName] = [context, other];
      } else {
        newRestrictions[toolName] = [other];
      }

      if (
        Object.keys(newRestrictions).length === 0 &&
        enabledIds.size === compatibleTools.length &&
        compatibleTools.every((t) => enabledIds.has(t.id))
      ) {
        onChange({
          tool_scope: "all",
          tool_allowance_ids: [],
          tool_restriction_ids: [],
          tool_context_restrictions: {},
        });
      } else {
        onChange({ tool_context_restrictions: newRestrictions });
      }
    },
    [restrictions, enabledIds, compatibleTools, onChange, handleToolToggle]
  );

  // --- MCP overrides ---

  const getMCPConfig = useCallback(
    (sourceId: string) =>
      (agent.mcp_sources_config || []).find(
        (c) => c.mcp_source_id === sourceId
      ),
    [agent.mcp_sources_config]
  );

  const updateMCPConfigs = useCallback(
    (configs: AgentMCPSourceConfig[]) => {
      onChange({ mcp_sources_config: configs });
    },
    [onChange]
  );

  const setMcpOverride = useCallback(
    (
      sourceId: string,
      toolName: string,
      field: OverrideField,
      value: boolean | null
    ) => {
      const current = agent.mcp_sources_config || [];
      updateMCPConfigs(
        current.map((c) => {
          if (c.mcp_source_id !== sourceId) return c;
          const overrides = [...(c.tool_overrides || [])];
          const idx = overrides.findIndex((o) => o.tool_name === toolName);

          if (idx >= 0) {
            const updated = { ...overrides[idx], [field]: value };
            if (
              updated.is_enabled === null &&
              updated.requires_confirmation === null
            ) {
              overrides.splice(idx, 1);
            } else {
              overrides[idx] = updated;
            }
          } else if (value !== null) {
            overrides.push({
              tool_name: toolName,
              is_enabled: field === "is_enabled" ? value : null,
              requires_confirmation:
                field === "requires_confirmation" ? value : null,
            });
          }

          return { ...c, tool_overrides: overrides };
        })
      );
    },
    [agent.mcp_sources_config, updateMCPConfigs]
  );

  const handleMcpSectionSelectAll = useCallback(
    (source: MCPToolSource, selectAll: boolean) => {
      const current = agent.mcp_sources_config || [];
      const config = current.find((c) => c.mcp_source_id === source.id);

      if (selectAll && !config) {
        updateMCPConfigs([
          ...current,
          { mcp_source_id: source.id, tool_overrides: [] },
        ]);
        return;
      }

      if (!selectAll && config) {
        updateMCPConfigs(
          current.filter((c) => c.mcp_source_id !== source.id)
        );
        return;
      }

      if (!config) return;

      const newOverrides = selectAll
        ? (config.tool_overrides || []).filter(
            (o) => o.is_enabled !== false
          ).map((o) => ({ ...o, is_enabled: null as boolean | null }))
        : source.discovered_tools.map((t) => {
            const existing = (config.tool_overrides || []).find(
              (o) => o.tool_name === t.name
            );
            return {
              tool_name: t.name,
              is_enabled: false as boolean | null,
              requires_confirmation: existing?.requires_confirmation ?? null,
            };
          });

      updateMCPConfigs(
        current.map((c) =>
          c.mcp_source_id === source.id
            ? { ...c, tool_overrides: newOverrides }
            : c
        )
      );
    },
    [agent.mcp_sources_config, updateMCPConfigs]
  );

  // --- OpenAPI overrides ---

  const getOpenAPIConfig = useCallback(
    (sourceId: string): AgentOpenAPISourceConfig | undefined =>
      (agent.openapi_sources_config || []).find(
        (c) => c.openapi_source_id === sourceId
      ),
    [agent.openapi_sources_config]
  );

  const updateOpenAPIConfigs = useCallback(
    (configs: AgentOpenAPISourceConfig[]) => {
      onChange({ openapi_sources_config: configs });
    },
    [onChange]
  );

  const setOpenAPIOverride = useCallback(
    (
      sourceId: string,
      operationId: string,
      field: OverrideField,
      value: boolean | null
    ) => {
      const current = agent.openapi_sources_config || [];
      updateOpenAPIConfigs(
        current.map((c) => {
          if (c.openapi_source_id !== sourceId) return c;
          const overrides = [...(c.operation_overrides || [])];
          const idx = overrides.findIndex(
            (o) => o.tool_name === operationId
          );

          if (idx >= 0) {
            const updated = { ...overrides[idx], [field]: value };
            if (
              updated.is_enabled === null &&
              updated.requires_confirmation === null
            ) {
              overrides.splice(idx, 1);
            } else {
              overrides[idx] = updated;
            }
          } else if (value !== null) {
            overrides.push({
              tool_name: operationId,
              is_enabled: field === "is_enabled" ? value : null,
              requires_confirmation:
                field === "requires_confirmation" ? value : null,
            });
          }

          return { ...c, operation_overrides: overrides };
        })
      );
    },
    [agent.openapi_sources_config, updateOpenAPIConfigs]
  );

  const handleOpenAPISectionSelectAll = useCallback(
    (source: OpenAPIToolSource, selectAll: boolean) => {
      const current = agent.openapi_sources_config || [];
      const config = current.find(
        (c) => c.openapi_source_id === source.id
      );

      if (selectAll && !config) {
        updateOpenAPIConfigs([
          ...current,
          { openapi_source_id: source.id, operation_overrides: [] },
        ]);
        return;
      }

      if (!selectAll && config) {
        updateOpenAPIConfigs(
          current.filter((c) => c.openapi_source_id !== source.id)
        );
        return;
      }

      if (!config) return;

      const newOverrides = selectAll
        ? (config.operation_overrides || []).filter(
            (o) => o.is_enabled !== false
          ).map((o) => ({ ...o, is_enabled: null as boolean | null }))
        : source.discovered_operations.map((op) => {
            const existing = (config.operation_overrides || []).find(
              (o) => o.tool_name === op.operation_id
            );
            return {
              tool_name: op.operation_id,
              is_enabled: false as boolean | null,
              requires_confirmation: existing?.requires_confirmation ?? null,
            };
          });

      updateOpenAPIConfigs(
        current.map((c) =>
          c.openapi_source_id === source.id
            ? { ...c, operation_overrides: newOverrides }
            : c
        )
      );
    },
    [agent.openapi_sources_config, updateOpenAPIConfigs]
  );

  // --- Resolve helpers for MCP/OpenAPI ---

  const resolveMcpEnabled = useCallback(
    (source: MCPToolSource, toolName: string): boolean => {
      const config = getMCPConfig(source.id);
      const ov = (config?.tool_overrides || []).find(
        (o) => o.tool_name === toolName
      );
      if (ov?.is_enabled !== null && ov?.is_enabled !== undefined)
        return ov.is_enabled;
      const sc = (source.tool_configs || []).find(
        (c) => c.tool_name === toolName
      );
      return sc?.is_enabled ?? true;
    },
    [getMCPConfig]
  );

  const resolveMcpConfirmation = useCallback(
    (source: MCPToolSource, toolName: string): boolean => {
      const config = getMCPConfig(source.id);
      const ov = (config?.tool_overrides || []).find(
        (o) => o.tool_name === toolName
      );
      if (
        ov?.requires_confirmation !== null &&
        ov?.requires_confirmation !== undefined
      )
        return ov.requires_confirmation;
      const sc = (source.tool_configs || []).find(
        (c) => c.tool_name === toolName
      );
      return sc?.requires_confirmation ?? false;
    },
    [getMCPConfig]
  );

  const hasMcpConfirmOverride = useCallback(
    (source: MCPToolSource, toolName: string): boolean => {
      const config = getMCPConfig(source.id);
      const ov = (config?.tool_overrides || []).find(
        (o) => o.tool_name === toolName
      );
      return (
        ov?.requires_confirmation !== null &&
        ov?.requires_confirmation !== undefined
      );
    },
    [getMCPConfig]
  );

  const resolveOpenAPIEnabled = useCallback(
    (source: OpenAPIToolSource, opId: string): boolean => {
      const config = getOpenAPIConfig(source.id);
      const ov = (config?.operation_overrides || []).find(
        (o) => o.tool_name === opId
      );
      if (ov?.is_enabled !== null && ov?.is_enabled !== undefined)
        return ov.is_enabled;
      const sc = (source.operation_configs || []).find(
        (c) => c.tool_name === opId
      );
      return sc?.is_enabled ?? true;
    },
    [getOpenAPIConfig]
  );

  const resolveOpenAPIConfirmation = useCallback(
    (source: OpenAPIToolSource, opId: string): boolean => {
      const config = getOpenAPIConfig(source.id);
      const ov = (config?.operation_overrides || []).find(
        (o) => o.tool_name === opId
      );
      if (
        ov?.requires_confirmation !== null &&
        ov?.requires_confirmation !== undefined
      )
        return ov.requires_confirmation;
      const sc = (source.operation_configs || []).find(
        (c) => c.tool_name === opId
      );
      return sc?.requires_confirmation ?? false;
    },
    [getOpenAPIConfig]
  );

  const hasOpenAPIConfirmOverride = useCallback(
    (source: OpenAPIToolSource, opId: string): boolean => {
      const config = getOpenAPIConfig(source.id);
      const ov = (config?.operation_overrides || []).find(
        (o) => o.tool_name === opId
      );
      return (
        ov?.requires_confirmation !== null &&
        ov?.requires_confirmation !== undefined
      );
    },
    [getOpenAPIConfig]
  );

  // --- Section selection state for MCP/OpenAPI ---

  const getMcpSelectionState = useCallback(
    (source: MCPToolSource): SelectionState => {
      const total = source.discovered_tools.length;
      if (total === 0) return "none";
      const enabled = source.discovered_tools.filter((t) =>
        resolveMcpEnabled(source, t.name)
      ).length;
      if (enabled === 0) return "none";
      if (enabled === total) return "all";
      return "some";
    },
    [resolveMcpEnabled]
  );

  const getOpenAPISelectionState = useCallback(
    (source: OpenAPIToolSource): SelectionState => {
      const total = source.discovered_operations.length;
      if (total === 0) return "none";
      const enabled = source.discovered_operations.filter((op) =>
        resolveOpenAPIEnabled(source, op.operation_id)
      ).length;
      if (enabled === 0) return "none";
      if (enabled === total) return "all";
      return "some";
    },
    [resolveOpenAPIEnabled]
  );

  // --- Global enable/disable all ---

  const totalEnabledCount = useMemo(() => {
    let count = enabledIds.size;

    for (const source of mcpSources) {
      const config = getMCPConfig(source.id);
      if (!config) continue;
      count += source.discovered_tools.filter((t) =>
        resolveMcpEnabled(source, t.name)
      ).length;
    }

    for (const source of openAPISources) {
      const config = getOpenAPIConfig(source.id);
      if (!config) continue;
      count += source.discovered_operations.filter((op) =>
        resolveOpenAPIEnabled(source, op.operation_id)
      ).length;
    }

    return count;
  }, [
    enabledIds,
    mcpSources,
    openAPISources,
    getMCPConfig,
    getOpenAPIConfig,
    resolveMcpEnabled,
    resolveOpenAPIEnabled,
  ]);

  const totalToolCount = useMemo(() => {
    let count = compatibleTools.length;
    for (const source of mcpSources) count += source.discovered_tools.length;
    for (const source of openAPISources)
      count += source.discovered_operations.length;
    return count;
  }, [compatibleTools, mcpSources, openAPISources]);

  const handleEnableAll = useCallback(() => {
    const updates: Partial<Agent> = {
      tool_scope: "all",
      tool_allowance_ids: [],
      tool_restriction_ids: [],
      tool_context_restrictions: {},
    };

    // Reset MCP overrides to enable everything
    const mcpConfigs = mcpSources.map((s) => ({
      mcp_source_id: s.id,
      tool_overrides: [] as AgentMCPSourceConfig["tool_overrides"],
    }));
    if (mcpConfigs.length > 0) updates.mcp_sources_config = mcpConfigs;

    // Reset OpenAPI overrides to enable everything
    const openAPIConfigs = openAPISources.map((s) => ({
      openapi_source_id: s.id,
      operation_overrides: [] as AgentOpenAPISourceConfig["operation_overrides"],
    }));
    if (openAPIConfigs.length > 0)
      updates.openapi_sources_config = openAPIConfigs;

    onChange(updates);
  }, [mcpSources, openAPISources, onChange]);

  const handleDisableAll = useCallback(() => {
    onChange({
      tool_scope: "none",
      tool_allowance_ids: [],
      tool_restriction_ids: [],
      mcp_sources_config: [],
      openapi_sources_config: [],
    });
  }, [onChange]);

  // --- Search filtering ---

  const matchesSearch = useCallback(
    (name: string, description?: string, path?: string) => {
      if (!searchQuery) return true;
      const q = searchQuery.toLowerCase();
      return (
        name.toLowerCase().includes(q) ||
        (description?.toLowerCase().includes(q) ?? false) ||
        (path?.toLowerCase().includes(q) ?? false)
      );
    },
    [searchQuery]
  );

  // --- Expand/collapse ---

  const toggleExpanded = useCallback((sourceId: string) => {
    setCollapsedSources((prev) => {
      const next = new Set(prev);
      if (next.has(sourceId)) next.delete(sourceId);
      else next.add(sourceId);
      return next;
    });
  }, []);

  const isExpanded = useCallback(
    (sourceId: string) => !collapsedSources.has(sourceId),
    [collapsedSources]
  );

  // --- Identity nudge ---

  const showIdentityNudge = useMemo(() => {
    const hasServerOrOpenAPI =
      (openAPISources && openAPISources.length > 0) ||
      tools.some((t) => t.tool_type === "server_side");
    return (
      hasServerOrOpenAPI &&
      (agent.channel === "discord" || agent.channel === "slack")
    );
  }, [openAPISources, tools, agent.channel]);

  return {
    searchQuery,
    setSearchQuery,
    showContextColumns,
    restrictions,
    supportsClientSide,

    compatibleTools,
    incompatibleTools,
    serverTools,
    clientTools,
    untypedTools,

    enabledIds,
    handleToolToggle,
    handleSdkSectionSelectAll,
    getSdkSectionSelectionState,

    isContextChecked,
    handleContextToggle,

    getMCPConfig,
    setMcpOverride,
    handleMcpSectionSelectAll,
    resolveMcpEnabled,
    resolveMcpConfirmation,
    hasMcpConfirmOverride,
    getMcpSelectionState,

    getOpenAPIConfig,
    setOpenAPIOverride,
    handleOpenAPISectionSelectAll,
    resolveOpenAPIEnabled,
    resolveOpenAPIConfirmation,
    hasOpenAPIConfirmOverride,
    getOpenAPISelectionState,

    totalEnabledCount,
    totalToolCount,
    handleEnableAll,
    handleDisableAll,

    matchesSearch,
    toggleExpanded,
    isExpanded,
    showIdentityNudge,
  };
}
