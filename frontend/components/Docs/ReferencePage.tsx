'use client';

/**
 * ReferencePage - Programmatic reference page renderer
 *
 * Renders API reference pages from structured manifest data.
 * Supports two page types:
 *   - Individual pages (React components, hooks, standalone types)
 *   - Domain pages (Core SDK method groups with inlined types)
 */

import { Property, PropertyList } from '@/components/mdx/PropertyList';
import { SyntaxHighlightedPre } from '@/components/mdx/SyntaxHighlightedPre';
import Link from 'next/link';

// ---------------------------------------------------------------------------
// Types (mirrored from the manifest)
// ---------------------------------------------------------------------------

interface PropertyInfo {
  name: string;
  type: string;
  required: boolean;
  default?: string;
  description: string;
  deprecated?: boolean;
}

interface DomainMethodData {
  name: string;
  signature: string;
  description: string;
  parameters: PropertyInfo[];
  returnType: string;
  isStatic: boolean;
  examples: string[];
}

interface DomainPropertyData {
  name: string;
  signature: string;
  description: string;
  returnType: string;
}

interface DomainTypeData {
  name: string;
  category: 'type' | 'type-alias';
  description: string;
  properties?: PropertyInfo[];
  typeDefinition: string;
}

export interface IndividualPageData {
  slug: string;
  title: string;
  category: 'component' | 'hook' | 'type' | 'type-alias';
  package: string;
  description: string;
  sourceFile: string;
  signature?: string;
  importStatement?: string;
  properties?: PropertyInfo[];
  returnType?: string;
  typeDefinition?: string;
  examples?: string[];
  relatedTypes?: string[];
  subtypes?: DomainTypeData[];
}

export interface DomainPageData {
  slug: string;
  title: string;
  category: 'domain';
  package: string;
  description: string;
  importStatement: string;
  methods: DomainMethodData[];
  properties: DomainPropertyData[];
  types: DomainTypeData[];
}

export type AnyPageData = IndividualPageData | DomainPageData;

// Keep backward compat alias
export type ReferencePageData = AnyPageData;

// ---------------------------------------------------------------------------
// Shared sub-components
// ---------------------------------------------------------------------------

const CATEGORY_LABELS: Record<string, { label: string; color: string }> = {
  component: { label: 'Component', color: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20' },
  hook: { label: 'Hook', color: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20' },
  domain: { label: 'Core SDK', color: 'bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20' },
  type: { label: 'Type', color: 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border-cyan-500/20' },
  'type-alias': { label: 'Type Alias', color: 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border-cyan-500/20' },
};

function CategoryBadge({ category }: { category: string }) {
  const meta = CATEGORY_LABELS[category] || { label: category, color: 'bg-muted text-muted-foreground' };
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-medium border ${meta.color}`}>
      {meta.label}
    </span>
  );
}

function PackageBadge({ pkg }: { pkg: string }) {
  return (
    <span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-mono text-muted-foreground bg-muted border border-border">
      {pkg}
    </span>
  );
}

function ImportBlock({ importStatement }: { importStatement: string }) {
  return (
    <div className="my-4">
      <SyntaxHighlightedPre
        code={importStatement}
        language="typescript"
      />
    </div>
  );
}

function SignatureBlock({ signature }: { signature: string }) {
  return (
    <div className="my-4">
      <SyntaxHighlightedPre
        code={signature}
        language="typescript"
      />
    </div>
  );
}

function TypeDefinitionBlock({ code }: { code: string }) {
  return (
    <div className="my-4">
      <SyntaxHighlightedPre
        code={code}
        language="typescript"
      />
    </div>
  );
}

function PropertiesSection({
  properties,
  title = 'Properties',
}: {
  properties: PropertyInfo[];
  title?: string;
}) {
  if (properties.length === 0) return null;

  const active = properties.filter(p => !p.deprecated);
  const deprecated = properties.filter(p => p.deprecated);

  return (
    <section className="mt-6">
      <h3 className="text-base font-semibold text-foreground mb-3">{title}</h3>
      <PropertyList>
        {active.map(prop => (
          <Property
            key={prop.name}
            name={prop.name}
            type={prop.type}
            required={prop.required}
            defaultValue={prop.default}
          >
            {prop.description || (
              <span className="text-muted-foreground italic">No description.</span>
            )}
          </Property>
        ))}
      </PropertyList>
      {deprecated.length > 0 && (
        <div className="mt-6">
          <h4 className="text-sm font-medium text-muted-foreground mb-3">Deprecated</h4>
          <PropertyList>
            {deprecated.map(prop => (
              <Property
                key={prop.name}
                name={prop.name}
                type={prop.type}
                required={prop.required}
                defaultValue={prop.default}
              >
                <span className="text-amber-600 dark:text-amber-500">
                  {prop.description || 'Deprecated.'}
                </span>
              </Property>
            ))}
          </PropertyList>
        </div>
      )}
    </section>
  );
}

function ExamplesSection({ examples }: { examples: string[] }) {
  if (examples.length === 0) return null;

  return (
    <section className="mt-6">
      <h3 className="text-base font-semibold text-foreground mb-3">
        {examples.length === 1 ? 'Example' : 'Examples'}
      </h3>
      <div className="space-y-4">
        {examples.map((code, i) => (
          <SyntaxHighlightedPre
            key={i}
            code={code}
            language="tsx"
          />
        ))}
      </div>
    </section>
  );
}

function RelatedTypesSection({ types }: { types: string[] }) {
  if (types.length === 0) return null;

  return (
    <section className="mt-8">
      <h2 className="text-lg font-semibold text-foreground mb-4">Related Types</h2>
      <div className="flex flex-wrap gap-2">
        {types.map(typeName => (
          <Link
            key={typeName}
            href={`/docs/reference/types/${typeName}`}
            className="inline-flex items-center px-3 py-1.5 rounded-md text-sm font-mono text-foreground bg-muted border border-border hover:border-primary/40 hover:text-primary transition-colors"
          >
            {typeName}
          </Link>
        ))}
      </div>
    </section>
  );
}

function SourceLink({ sourceFile }: { sourceFile: string }) {
  return (
    <div className="mt-8 pt-4 border-t border-border">
      <span className="text-xs text-muted-foreground">
        Source: <code className="text-xs">{sourceFile}</code>
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Individual Page Renderer (React components, hooks, standalone types)
// ---------------------------------------------------------------------------

function IndividualPage({ page }: { page: IndividualPageData }) {
  const propsTitle =
    page.category === 'component' ? 'Props' :
    page.category === 'hook' ? 'Return Value' :
    'Properties';

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-3">
          <CategoryBadge category={page.category} />
          <PackageBadge pkg={page.package} />
        </div>

        <h1 className="text-3xl font-bold text-foreground tracking-tight">
          {page.title}
        </h1>

        {page.description && (
          <p className="mt-3 text-base text-muted-foreground leading-relaxed max-w-2xl">
            {page.description.split('\n')[0]}
          </p>
        )}
      </div>

      {/* Import */}
      {page.importStatement && (
        <ImportBlock importStatement={page.importStatement} />
      )}

      {/* Signature */}
      {page.signature && (
        <section className="mt-6">
          <h2 className="text-lg font-semibold text-foreground mb-3">Signature</h2>
          <SignatureBlock signature={page.signature} />
        </section>
      )}

      {/* Type definition */}
      {page.typeDefinition && (page.category === 'type' || page.category === 'type-alias') && (
        <section className="mt-6">
          <h2 className="text-lg font-semibold text-foreground mb-3">Definition</h2>
          <TypeDefinitionBlock code={page.typeDefinition} />
        </section>
      )}

      {/* Properties / Props / Return Value */}
      {page.properties && page.properties.length > 0 && (
        <section className="mt-8">
          <h2 className="text-lg font-semibold text-foreground mb-4">{propsTitle}</h2>
          <PropertiesSection properties={page.properties} title={propsTitle} />
        </section>
      )}

      {/* Return type */}
      {page.returnType && (
        <section className="mt-6">
          <h2 className="text-lg font-semibold text-foreground mb-3">Returns</h2>
          <div className="border border-border rounded-lg px-4 py-3">
            <code className="text-sm font-mono text-foreground">{page.returnType}</code>
          </div>
        </section>
      )}

      {/* Examples */}
      {page.examples && page.examples.length > 0 && (
        <ExamplesSection examples={page.examples} />
      )}

      {/* Related Types */}
      {page.relatedTypes && page.relatedTypes.length > 0 && (
        <RelatedTypesSection types={page.relatedTypes} />
      )}

      {/* Inlined sub-types (e.g. EdgeTriggerConfig on PillarConfig page) */}
      {page.subtypes && page.subtypes.length > 0 && (
        <section className="mt-12">
          <h2 className="text-xl font-semibold text-foreground mb-6">Related Configuration Types</h2>
          <div className="space-y-10">
            {page.subtypes.map(sub => (
              <InlinedType key={sub.name} type={sub} />
            ))}
          </div>
        </section>
      )}

      {/* Source */}
      <SourceLink sourceFile={page.sourceFile} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Domain Page Renderer (Core SDK method groups)
// ---------------------------------------------------------------------------

function DomainPage({ page }: { page: DomainPageData }) {
  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-3">
          <CategoryBadge category="domain" />
          <PackageBadge pkg={page.package} />
        </div>

        <h1 className="text-3xl font-bold text-foreground tracking-tight">
          {page.title}
        </h1>

        <p className="mt-3 text-base text-muted-foreground leading-relaxed max-w-2xl">
          {page.description}
        </p>
      </div>

      {/* Import */}
      <ImportBlock importStatement={page.importStatement} />

      {/* On-page TOC */}
      <OnPageTOC page={page} />

      {/* Methods */}
      {page.methods.length > 0 && (
        <section className="mt-10">
          <h2 className="text-xl font-semibold text-foreground mb-6">Methods</h2>
          <div className="space-y-10">
            {page.methods.map(method => (
              <MethodEntry key={method.name} method={method} />
            ))}
          </div>
        </section>
      )}

      {/* Properties (getters) */}
      {page.properties.length > 0 && (
        <section className="mt-10">
          <h2 className="text-xl font-semibold text-foreground mb-6">Properties</h2>
          <div className="space-y-10">
            {page.properties.map(prop => (
              <PropertyEntry key={prop.name} property={prop} />
            ))}
          </div>
        </section>
      )}

      {/* Types */}
      {page.types.length > 0 && (
        <section className="mt-10">
          <h2 className="text-xl font-semibold text-foreground mb-6">Types</h2>
          <div className="space-y-10">
            {page.types.map(type => (
              <InlinedType key={type.name} type={type} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

/** Compact on-page table of contents for domain pages */
function OnPageTOC({ page }: { page: DomainPageData }) {
  const items: Array<{ id: string; label: string; kind: string }> = [];

  for (const m of page.methods) {
    items.push({ id: m.name, label: `${m.name}()`, kind: 'method' });
  }
  for (const p of page.properties) {
    items.push({ id: p.name, label: `Pillar.${p.name}`, kind: 'property' });
  }
  for (const t of page.types) {
    items.push({ id: t.name, label: t.name, kind: t.category === 'type' ? 'type' : 'type-alias' });
  }

  if (items.length <= 1) return null;

  return (
    <nav className="mt-6 mb-8 rounded-lg border border-border bg-muted/30 px-5 py-4">
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">On this page</p>
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        {items.map(item => (
          <a
            key={item.id}
            href={`#${item.id}`}
            className="text-sm font-mono text-muted-foreground hover:text-foreground transition-colors"
          >
            {item.label}
          </a>
        ))}
      </div>
    </nav>
  );
}

/** Renders a single method within a domain page */
function MethodEntry({ method }: { method: DomainMethodData }) {
  return (
    <div id={method.name} className="scroll-mt-20 border-t border-border pt-6">
      <h3 className="text-lg font-semibold text-foreground font-mono">
        {method.isStatic ? 'Pillar.' : 'Pillar.'}{method.name}()
      </h3>

      {method.description && (
        <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
          {method.description}
        </p>
      )}

      <div className="mt-3">
        <SignatureBlock signature={method.signature} />
      </div>

      {method.parameters.length > 0 && (
        <PropertiesSection properties={method.parameters} title="Parameters" />
      )}

      {method.returnType && method.returnType !== 'void' && (
        <div className="mt-4">
          <h4 className="text-sm font-semibold text-foreground mb-2">Returns</h4>
          <div className="border border-border rounded-lg px-4 py-2">
            <code className="text-sm font-mono text-foreground">{method.returnType}</code>
          </div>
        </div>
      )}

      {method.examples.length > 0 && (
        <ExamplesSection examples={method.examples} />
      )}
    </div>
  );
}

/** Renders a single getter/property within a domain page */
function PropertyEntry({ property }: { property: DomainPropertyData }) {
  return (
    <div id={property.name} className="scroll-mt-20 border-t border-border pt-6">
      <h3 className="text-lg font-semibold text-foreground font-mono">
        Pillar.{property.name}
      </h3>

      {property.description && (
        <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
          {property.description}
        </p>
      )}

      <div className="mt-3">
        <SignatureBlock signature={property.signature} />
      </div>

      <div className="mt-4">
        <h4 className="text-sm font-semibold text-foreground mb-2">Type</h4>
        <div className="border border-border rounded-lg px-4 py-2">
          <code className="text-sm font-mono text-foreground">{property.returnType}</code>
        </div>
      </div>
    </div>
  );
}

/** Renders a type or type-alias inlined on a domain page */
function InlinedType({ type }: { type: DomainTypeData }) {
  return (
    <div id={type.name} className="scroll-mt-20 border-t border-border pt-6">
      <div className="flex items-center gap-3 mb-2">
        <h3 className="text-lg font-semibold text-foreground font-mono">{type.name}</h3>
        <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded border border-border">
          {type.category === 'type' ? 'interface' : 'type'}
        </span>
      </div>

      {type.description && (
        <p className="mt-1 text-sm text-muted-foreground leading-relaxed">
          {type.description}
        </p>
      )}

      <TypeDefinitionBlock code={type.typeDefinition} />

      {type.properties && type.properties.length > 0 && (
        <PropertiesSection properties={type.properties} title="Properties" />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Component — dispatches to the right renderer
// ---------------------------------------------------------------------------

export function ReferencePage({ page }: { page: AnyPageData }) {
  if (page.category === 'domain') {
    return <DomainPage page={page as DomainPageData} />;
  }
  return <IndividualPage page={page as IndividualPageData} />;
}
