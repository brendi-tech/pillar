'use client';

/**
 * TypeDocs - Auto-generated API reference component
 *
 * Reads structured type data from the build-time generated JSON
 * (scripts/generate-api-docs.ts) and renders it using the existing
 * PropertyList / Property components.
 *
 * Usage in MDX:
 *   <TypeDocs type="PanelConfig" />
 *   <TypeDocs type="ThemeColors" />
 *   <TypeDocs type="PanelPosition" />      // type alias
 *   <TypeDocs method="open" />              // Pillar class method
 */

import apiTypes from '@/generated/api-types.json';
import { Property, PropertyList } from './PropertyList';

// ---------------------------------------------------------------------------
// Types for the generated JSON shape
// ---------------------------------------------------------------------------

interface PropertyData {
  name: string;
  type: string;
  required: boolean;
  default?: string;
  description: string;
  deprecated?: boolean;
}

interface InterfaceData {
  name: string;
  description: string;
  sourceFile: string;
  properties: PropertyData[];
}

interface TypeAliasData {
  name: string;
  description: string;
  sourceFile: string;
  type: string;
}

interface MethodParameterData {
  name: string;
  type: string;
  required: boolean;
  description: string;
}

interface MethodData {
  name: string;
  signature: string;
  description: string;
  parameters: MethodParameterData[];
  returnType: string;
  isStatic: boolean;
}

interface ApiTypesData {
  generatedAt: string;
  interfaces: Record<string, InterfaceData>;
  typeAliases: Record<string, TypeAliasData>;
  methods: MethodData[];
}

const data = apiTypes as unknown as ApiTypesData;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface TypeDocsProps {
  /** Interface or type alias name to render (e.g., "PanelConfig") */
  type?: string;
  /** Pillar class method name to render (e.g., "open") */
  method?: string;
  /** Optional title override (defaults to the type/method name) */
  title?: string;
  /** Whether to show the source file path */
  showSource?: boolean;
}

/**
 * Render a single interface property.
 */
function renderProperty(prop: PropertyData) {
  // Format type for display, clean up long union types
  let displayType = prop.type;
  // Replace reference types with quoted string literals for readability
  if (displayType.length > 60) {
    displayType = displayType.replace(/\n\s*/g, ' ');
  }

  return (
    <Property
      key={prop.name}
      name={prop.name}
      type={displayType}
      required={prop.required}
      defaultValue={prop.default}
    >
      {prop.description || <span className="text-muted-foreground italic">No description.</span>}
    </Property>
  );
}

/**
 * Render an interface as a PropertyList.
 */
function InterfaceDocs({ iface, showSource }: { iface: InterfaceData; showSource?: boolean }) {
  if (iface.properties.length === 0) {
    return (
      <div className="my-4 text-sm text-muted-foreground italic">
        No properties defined.
      </div>
    );
  }

  return (
    <div>
      {iface.description && (
        <p className="text-sm text-muted-foreground mb-3">{iface.description}</p>
      )}
      {showSource && (
        <p className="text-xs text-muted-foreground mb-2">
          Source: <code className="text-xs">{iface.sourceFile}</code>
        </p>
      )}
      <PropertyList>
        {iface.properties.map(renderProperty)}
      </PropertyList>
    </div>
  );
}

/**
 * Render a type alias as a simple definition.
 */
function TypeAliasDocs({ alias, showSource }: { alias: TypeAliasData; showSource?: boolean }) {
  return (
    <div className="my-4">
      {alias.description && (
        <p className="text-sm text-muted-foreground mb-2">{alias.description}</p>
      )}
      {showSource && (
        <p className="text-xs text-muted-foreground mb-2">
          Source: <code className="text-xs">{alias.sourceFile}</code>
        </p>
      )}
      <div className="border border-border rounded-lg px-4 py-3">
        <code className="text-sm font-mono text-foreground">{alias.type}</code>
      </div>
    </div>
  );
}

/**
 * Render a Pillar class method.
 */
function MethodDocs({ method, showSource }: { method: MethodData; showSource?: boolean }) {
  return (
    <div className="my-4">
      {method.description && (
        <p className="text-sm text-muted-foreground mb-3">{method.description}</p>
      )}
      <div className="bg-muted/30 border border-border rounded-lg px-4 py-3 mb-3">
        <code className="text-sm font-mono text-foreground">
          {method.isStatic ? 'static ' : ''}{method.signature}
        </code>
      </div>
      {method.parameters.length > 0 && (
        <PropertyList title="Parameters">
          {method.parameters.map((param) => (
            <Property
              key={param.name}
              name={param.name}
              type={param.type}
              required={param.required}
            >
              {param.description || <span className="text-muted-foreground italic">No description.</span>}
            </Property>
          ))}
        </PropertyList>
      )}
    </div>
  );
}

/**
 * Main TypeDocs component.
 * Looks up the type or method in the generated JSON and renders it.
 */
export function TypeDocs({ type, method, title, showSource = false }: TypeDocsProps) {
  if (type) {
    // Check interfaces first
    const iface = data.interfaces[type];
    if (iface) {
      return <InterfaceDocs iface={iface} showSource={showSource} />;
    }

    // Check type aliases
    const alias = data.typeAliases[type];
    if (alias) {
      return <TypeAliasDocs alias={alias} showSource={showSource} />;
    }

    // Not found
    return (
      <div className="my-4 bg-red-900/20 text-red-400 p-4 rounded-lg text-sm">
        TypeDocs: Type <code>&quot;{type}&quot;</code> not found in generated API data.
        Run <code>npx tsx scripts/generate-api-docs.ts</code> to regenerate.
      </div>
    );
  }

  if (method) {
    const methodData = data.methods.find((m) => m.name === method);
    if (methodData) {
      return <MethodDocs method={methodData} showSource={showSource} />;
    }

    return (
      <div className="my-4 bg-red-900/20 text-red-400 p-4 rounded-lg text-sm">
        TypeDocs: Method <code>&quot;{method}&quot;</code> not found in generated API data.
        Run <code>npx tsx scripts/generate-api-docs.ts</code> to regenerate.
      </div>
    );
  }

  return (
    <div className="my-4 bg-red-900/20 text-red-400 p-4 rounded-lg text-sm">
      TypeDocs: Provide either a <code>type</code> or <code>method</code> prop.
    </div>
  );
}
