"use client";

import { ArrowRight } from "lucide-react";
import Link from "next/link";

function ToolLink({
  name,
  href,
  domain,
}: {
  name: string;
  href: string;
  domain: string;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1.5 text-sm text-[#6B6B6B] hover:text-[#1A1A1A] transition-colors"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={`https://www.google.com/s2/favicons?domain=${domain}&sz=32`}
        alt=""
        width={14}
        height={14}
        className="rounded-sm"
      />
      {name}
    </a>
  );
}

function Pullquote({ children }: { children: React.ReactNode }) {
  return (
    <blockquote className="border-l-[3px] border-[#FF6E00] pl-6 my-10 md:my-12">
      <p className="font-editorial text-xl md:text-2xl lg:text-[1.75rem] lg:leading-[1.35] text-[#1A1A1A]">
        {children}
      </p>
    </blockquote>
  );
}

export function BuildVsBuyPage() {
  return (
    <div className="py-12 sm:py-16 md:py-20">
      {/* Hero */}
      <div className="max-w-3xl mx-auto mb-6 md:mb-8">
        <p className="text-xs font-mono uppercase tracking-[0.2em] text-[#FF6E00] mb-6">
          Build vs Buy
        </p>
        <h1 className="font-editorial text-3xl md:text-5xl lg:text-[3.5rem] lg:leading-[1.1] text-[#1A1A1A] mb-6">
          Build vs. buy your AI copilot
        </h1>
        <p className="text-lg md:text-xl text-[#4A4A4A] leading-relaxed">
          What it actually takes to build a copilot yourself, and when it makes
          sense to buy one instead.
        </p>
      </div>

      {/* Body */}
      <article className="max-w-3xl mx-auto text-[#4A4A4A] text-base md:text-[1.0625rem] leading-[1.75]">
        <p className="mb-6">
          Teams trying to add a copilot to their app generally starte with a clear goal — &ldquo;let users ask the product to
          do things in natural language&rdquo;. But they often end up operating a second
          infrastructure stack alongside their actual product. This page is for
          teams deciding whether to keep building or switch to something that
          handles the infrastructure so they can focus on what their copilot
          actually does.
        </p>

        {/* The three pillars */}
        <h2 className="font-editorial text-2xl md:text-3xl text-[#1A1A1A] mt-14 mb-6">
          If you decide to build, you need three things
        </h2>
        <p className="mb-8">
          Ask any AI &ldquo;how do I add a copilot to my SaaS?&rdquo; and
          you&apos;ll get the same architecture.{" "}
          <a
            href="https://chatgpt.com/?q=I%20want%20to%20build%20an%20AI%20copilot%20for%20my%20SaaS%20product.%20What%20do%20I%20need%20to%20build%3F"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[#FF6E00] hover:underline"
          >
            Try it yourself
          </a>
          . Three layers, each its own project.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-0 border border-[#E5E0D8] rounded-lg overflow-hidden mb-6 not-prose">
          <div className="p-5 border-b md:border-b-0 md:border-r border-[#E5E0D8] flex flex-col">
            <div className="flex items-center gap-2.5 mb-2">
              <span className="text-sm font-mono text-[#FF6E00]">01</span>
              <h3 className="text-lg font-semibold text-[#1A1A1A]">
                Knowledge layer
              </h3>
            </div>
            <p className="text-sm text-[#4A4A4A] leading-relaxed mb-4">
              A vector database, ingestion pipeline, embedding generation,
              retrieval API with re-ranking, and sync jobs to keep the index
              fresh.
            </p>
            <div className="flex flex-col gap-1.5 mt-auto pt-4 border-t border-[#E5E0D8]">
              <ToolLink name="Pinecone" href="https://www.pinecone.io" domain="pinecone.io" />
              <ToolLink name="pgvector" href="https://github.com/pgvector/pgvector" domain="github.com" />
              <ToolLink name="Weaviate" href="https://weaviate.io" domain="weaviate.io" />
            </div>
          </div>

          <div className="p-5 border-b md:border-b-0 md:border-r border-[#E5E0D8] flex flex-col">
            <div className="flex items-center gap-2.5 mb-2">
              <span className="text-sm font-mono text-[#FF6E00]">02</span>
              <h3 className="text-lg font-semibold text-[#1A1A1A]">
                Backend agent
              </h3>
            </div>
            <p className="text-sm text-[#4A4A4A] leading-relaxed mb-4">
              A server-side service for planning, a tool registry, a streaming
              bridge to the browser, and auth forwarding so the agent acts as
              the user.
            </p>
            <div className="flex flex-col gap-1.5 mt-auto pt-4 border-t border-[#E5E0D8]">
              <ToolLink name="LangChain" href="https://www.langchain.com" domain="langchain.com" />
              <ToolLink name="LangGraph" href="https://www.langchain.com/langgraph" domain="langchain.com" />
              <ToolLink name="Mastra" href="https://mastra.ai" domain="mastra.ai" />
            </div>
          </div>

          <div className="p-5 flex flex-col">
            <div className="flex items-center gap-2.5 mb-2">
              <span className="text-sm font-mono text-[#FF6E00]">03</span>
              <h3 className="text-lg font-semibold text-[#1A1A1A]">
                Frontend chat UI
              </h3>
            </div>
            <p className="text-sm text-[#4A4A4A] leading-relaxed mb-4">
              Chat panel, streaming display, tool call rendering, confirmation
              flows, and client state serialization for the backend.
            </p>
            <div className="flex flex-col gap-1.5 mt-auto pt-4 border-t border-[#E5E0D8]">
              <ToolLink name="CopilotKit" href="https://www.copilotkit.ai" domain="copilotkit.ai" />
              <ToolLink name="Vercel AI SDK" href="https://sdk.vercel.ai" domain="vercel.com" />
              <ToolLink name="OpenAI ChatKit" href="https://github.com/openai/chatkit-js" domain="openai.com" />
            </div>
          </div>
        </div>

        <Pullquote>
          Before you&apos;ve written a single tool, you&apos;re operating a
          second system.
        </Pullquote>

        {/* The glue */}
        <h2 className="font-editorial text-2xl md:text-3xl text-[#1A1A1A] mt-14 mb-6">
          The real cost is the glue between them
        </h2>
        <p className="mb-6">
          Those three systems sound like distinct, manageable projects. In
          practice, the integration work between them is where teams spend most
          of their time.
        </p>
        <p className="mb-6">
          You define tools twice — once on the backend where the agent can plan
          around them, and again on the frontend where they actually execute. You
          serialize client state so the backend can &ldquo;see&rdquo; what the
          user sees. You build a streaming transport so the backend can push tool
          calls back into the browser. You forward auth tokens so the agent
          service can act with the user&apos;s permissions. And you coordinate
          releases so the backend planner and frontend executor don&apos;t drift
          out of sync.
        </p>
        <p className="mb-6">
          When something breaks, you debug across two runtimes, often in two
          languages. The failure could be in the planning step, the streaming
          bridge, the tool execution, or the state sync. None of this is product
          work. It&apos;s plumbing.
        </p>

        {/* What Pillar replaces */}
        <h2 className="font-editorial text-2xl md:text-3xl text-[#1A1A1A] mt-14 mb-6">
          What Pillar replaces
        </h2>
        <p className="mb-6">
          Pillar is one SDK. You install it, register tools in your frontend
          code, and the copilot works. Each of the three systems you were going
          to build maps to something Pillar already provides.
        </p>
        <p className="mb-6">
          Instead of a vector database and ingestion pipeline, Pillar gives you a
          managed knowledge base. Upload your docs or connect your help center.
          Pillar handles embedding, chunking, retrieval, and freshness. You
          don&apos;t run infrastructure for it.
        </p>
        <p className="mb-6">
          Instead of a backend agent service, Pillar hosts the reasoning server.
          Your tools are registered client-side with JSON schemas and
          descriptions. The model picks which to call and in what order. When it
          needs to chain steps — create a dashboard, then add panels, then set
          alerts — it calls tools sequentially and uses each result as input to
          the next. That&apos;s native LLM tool-calling. You don&apos;t need a
          state machine.
        </p>
        <p className="mb-6">
          Instead of building a chat UI with streaming, tool cards, and
          confirmation flows, the SDK ships them.{" "}
          <code className="text-sm bg-[#F3EFE8] px-1.5 py-0.5 rounded text-[#1A1A1A]">
            npm install @pillar-ai/react
          </code>
          , wrap your app in the provider, and register your tools in a hook.
          Three files.
        </p>
        <p className="mb-6">
          The glue work — duplicate tool definitions, state serialization,
          streaming bridge, auth forwarding, coordinated releases — disappears
          because there&apos;s no split architecture. Tools live in your frontend
          code, next to the components that already know how to do the work.
          Planning happens on Pillar&apos;s servers. Execution happens in the
          browser with the user&apos;s existing session.
        </p>

        <Pullquote>
          If the user can&apos;t do something, the copilot can&apos;t either. No
          proxy servers. No token forwarding. No permission mapping layer.
        </Pullquote>

        {/* Teams getting set up */}
        <h2 className="font-editorial text-2xl md:text-3xl text-[#1A1A1A] mt-14 mb-6">
          Teams are getting set up in days, not months
        </h2>
        <p className="mb-6">
          The DIY copilot stack is a multi-month project. Teams tell us they
          spent four to eight weeks on infrastructure before their copilot could
          do anything useful — and they still had a backlog of integration work
          when they launched.
        </p>
        <p className="mb-6">
          With Pillar, the pattern we see is different. A team installs the SDK,
          registers a handful of tools that call their existing APIs, and has a
          working copilot in a few days. The first week is usually spent on tool
          quality — writing better descriptions, adding confirmation flows for
          sensitive actions, tuning what the copilot can read vs. write. That
          work matters regardless of which architecture you choose, but with
          Pillar you start there instead of spending weeks on plumbing first.
        </p>
        <p className="mb-6">
          We&apos;ve seen teams go from &ldquo;npm install&rdquo; to a copilot
          that creates dashboards, invites users, navigates the app, and answers
          product questions — in under a week. The integration with{" "}
          <Link href="/demos/grafana" className="text-[#FF6E00] hover:underline">
            Grafana
          </Link>{" "}
          and{" "}
          <Link href="/demos/superset" className="text-[#FF6E00] hover:underline">
            Apache Superset
          </Link>{" "}
          on our demos page shows what that looks like in a real product.
        </p>
        <p className="mb-6">
          The difference isn&apos;t that Pillar is a simpler product. It&apos;s
          that the infrastructure — the vector database, the reasoning server,
          the streaming transport, the chat UI — is already built. You spend your
          time on the part that&apos;s unique to your product: the tools.
        </p>

        {/* When building makes sense */}
        <h2 className="font-editorial text-2xl md:text-3xl text-[#1A1A1A] mt-14 mb-6">
          When building your own makes sense
        </h2>
        <p className="mb-6">
          Pillar handles user-initiated, permission-sensitive copilots — the kind
          where a user types a request, the AI calls a few functions inside the
          app, and the user stays in control.
        </p>
        <p className="mb-6">
          There are real cases where you need a custom orchestration layer.
          Background automation that runs without the user present. Durable
          workflows that need to survive server restarts and resume hours later.
          Multi-agent architectures where specialized agents hand off work to
          each other. Complex branching logic driven by business rules rather
          than tool output.
        </p>
        <p className="mb-6">
          If your copilot needs those things, build the backend. Use{" "}
          <a href="https://www.langchain.com/langgraph" target="_blank" rel="noopener noreferrer" className="text-[#FF6E00] hover:underline">LangGraph</a>,{" "}
          <a href="https://temporal.io" target="_blank" rel="noopener noreferrer" className="text-[#FF6E00] hover:underline">Temporal</a>, or{" "}
          <a href="https://hatchet.run" target="_blank" rel="noopener noreferrer" className="text-[#FF6E00] hover:underline">Hatchet</a>.
          But most product copilots don&apos;t need them.
          They need the AI to take a user request, call a few tools in sequence,
          and show the result. That&apos;s what Pillar does.
        </p>

        {/* Future-proofing */}
        <h2 className="font-editorial text-2xl md:text-3xl text-[#1A1A1A] mt-14 mb-6">
          What buying gets you that building doesn&apos;t
        </h2>
        <p className="mb-6">
          When you build your own stack, you freeze the architecture at the
          moment you ship it. Every new standard, protocol, or model capability
          is another integration project on your backlog.
        </p>
        <p className="mb-6">
          With Pillar, that work is on us. When new models ship with better
          tool-calling, Pillar adopts them. When the reasoning layer improves, your
          copilot gets better without a deploy. Your team stays focused on the
          product, not on keeping agent infrastructure current.
        </p>
        <p className="mb-6">
          A concrete example:{" "}
          <a
            href="https://webmcp.org"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[#FF6E00] hover:underline"
          >
            WebMCP
          </a>{" "}
          is a W3C proposal that adds{" "}
          <code className="text-sm bg-[#F3EFE8] px-1.5 py-0.5 rounded text-[#1A1A1A]">
            navigator.modelContext
          </code>{" "}
          to the browser, letting external AI agents discover and call tools
          your app registers. When you define tools with Pillar, they
          automatically become your WebMCP surface — available to Claude,
          ChatGPT, Cursor, and any agent your users bring. If you built the
          three-system stack yourself, you&apos;d need to build that integration
          separately. With Pillar, it ships when the spec ships.
        </p>

        <Pullquote>
          The tools you define for your copilot become your product&apos;s agent
          API. You write them once. Pillar keeps them current.
        </Pullquote>

        {/* CTA */}
        <div className="mt-14 mb-4 pt-10 border-t border-[#E5E0D8]">
          <h2 className="font-editorial text-2xl md:text-3xl text-[#1A1A1A] mb-4">
            Try it
          </h2>
          <p className="mb-6">
            If you want a quick readiness check, run the{" "}
            <Link
              href="/resources/agent-score"
              className="text-[#FF6E00] hover:underline"
            >
              agent tool score
            </Link>
            . If you want to see what a single-SDK copilot looks like in a real
            app, check the live demos on{" "}
            <Link
              href="/demos/grafana"
              className="text-[#FF6E00] hover:underline"
            >
              Grafana
            </Link>{" "}
            and{" "}
            <Link
              href="/demos/superset"
              className="text-[#FF6E00] hover:underline"
            >
              Apache Superset
            </Link>
            .
          </p>
          <p className="mb-8">
            Questions? Email{" "}
            <a
              href="mailto:founders@trypillar.com"
              className="text-[#FF6E00] hover:underline"
            >
              founders@trypillar.com
            </a>
            .
          </p>
          <Link
            href="/signup"
            className="group/btn inline-flex items-center justify-center rounded-lg bg-[#FF6E00] hover:bg-[#E06200] text-white px-7 py-3 text-sm font-medium transition-colors"
          >
            <span className="translate-x-[9px] group-hover/btn:translate-x-0 transition-transform duration-200 ease-out">
              Get Started
            </span>
            <ArrowRight className="w-4 h-4 ml-1.5 opacity-0 group-hover/btn:opacity-100 transition-opacity duration-200 ease-out" />
          </Link>
        </div>
      </article>
    </div>
  );
}
