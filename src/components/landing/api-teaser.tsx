"use client";

import Link from "next/link";
import { Code2, ExternalLink } from "lucide-react";
import { ScrollReveal } from "./scroll-reveal";

const codeSnippet = `// Get the best RPC endpoint (score-weighted)
const res = await fetch('/api/endpoints/best?type=rpc');
const { endpoint, strategy } = await res.json();

// Use with republic-sdk
const client = await RepublicClient.connect({
  rpcUrl: endpoint.url,
});`;

export function ApiTeaser() {
  return (
    <section className="bg-indigo-dark px-4 py-24 md:py-32">
      <div className="mx-auto max-w-4xl">
        <ScrollReveal>
          <div className="flex items-center justify-center gap-2">
            <Code2 className="size-6 text-indigo-light" />
            <h2 className="font-display text-3xl font-bold text-indigo-light md:text-4xl">
              Developer-Friendly API
            </h2>
          </div>
          <p className="mx-auto mt-4 max-w-2xl text-center text-mist/70">
            Simple REST API for programmatic access to chain intelligence.
          </p>
        </ScrollReveal>

        <ScrollReveal delay={0.2}>
          <div className="mt-12 overflow-x-auto rounded-xl border border-indigo-DEFAULT/30 bg-indigo-dark/50 p-6">
            <pre className="font-mono text-xs leading-relaxed text-indigo-light md:text-sm">
              <code>{codeSnippet}</code>
            </pre>
          </div>
        </ScrollReveal>

        <ScrollReveal delay={0.3} className="mt-8 text-center">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 rounded-lg border border-indigo-DEFAULT/30 px-6 py-3 text-sm font-medium text-indigo-light transition-colors hover:border-indigo-light hover:text-white"
          >
            Explore Dashboard
            <ExternalLink className="size-4" />
          </Link>
        </ScrollReveal>
      </div>
    </section>
  );
}
