"use client";

import { useRef } from "react";
import Link from "next/link";
import { motion, useInView, useReducedMotion } from "motion/react";
import { Code2, ExternalLink } from "lucide-react";
import { codeLine } from "@/lib/animations";
import { ScrollReveal } from "./scroll-reveal";

const codeLines = [
  "// Get the best RPC endpoint (score-weighted)",
  "const res = await fetch('/api/endpoints/best?type=rpc');",
  "const { endpoint, strategy } = await res.json();",
  "",
  "// Use with republic-sdk",
  "const client = await RepublicClient.connect({",
  "  rpcUrl: endpoint.url,",
  "});",
];

export function ApiTeaser() {
  const codeRef = useRef<HTMLDivElement>(null);
  const isInView = useInView(codeRef, { once: true, margin: "-80px" });
  const prefersReduced = useReducedMotion();

  return (
    <section className="bg-[#1a1230] px-4 py-24 md:py-32">
      {/* Section separator */}
      <div className="h-px bg-gradient-to-r from-transparent via-soft-violet/20 to-transparent" />

      <div className="mx-auto max-w-4xl pt-8">
        <ScrollReveal>
          <div className="flex items-center justify-center gap-2">
            <Code2 className="size-6 text-soft-violet" />
            <h2 className="font-display text-3xl font-bold text-soft-violet md:text-4xl">
              Developer-Friendly API
            </h2>
          </div>
          <p className="mx-auto mt-4 max-w-2xl text-center text-dusty-lavender/70">
            Simple REST API for programmatic access to chain intelligence.
          </p>
        </ScrollReveal>

        <ScrollReveal delay={0.2}>
          <div
            ref={codeRef}
            className="mt-12 overflow-x-auto rounded-xl border border-soft-violet/30 bg-deep-iris/10 p-6 backdrop-blur-sm shadow-lg shadow-soft-violet/5"
          >
            <pre className="font-mono text-xs leading-relaxed md:text-sm">
              {codeLines.map((line, i) => (
                <motion.code
                  key={i}
                  variants={prefersReduced ? undefined : codeLine}
                  initial={prefersReduced ? undefined : "hidden"}
                  animate={prefersReduced ? undefined : isInView ? "visible" : "hidden"}
                  custom={i}
                  className="block text-dusty-lavender"
                >
                  {line || "\u00A0"}
                </motion.code>
              ))}
            </pre>
          </div>
        </ScrollReveal>

        <ScrollReveal delay={0.3} className="mt-8 text-center">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 rounded-lg border border-soft-violet/30 px-6 py-3 text-sm font-medium text-soft-violet transition-all hover:scale-105 hover:border-soft-violet hover:bg-soft-violet/10"
          >
            Explore Dashboard
            <ExternalLink className="size-4" />
          </Link>
        </ScrollReveal>
      </div>
    </section>
  );
}
