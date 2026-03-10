"use client";

import { motion } from "motion/react";
import { Database, Cpu, Route } from "lucide-react";
import { staggerItem } from "@/lib/animations";
import { ScrollReveal } from "./scroll-reveal";

const steps = [
  {
    icon: Database,
    title: "Index",
    description:
      "Continuously sync validators, endpoints, and network metrics via republic-sdk.",
  },
  {
    icon: Cpu,
    title: "Analyze",
    description:
      "Score endpoints/validators, detect anomalies, track trends with EMA smoothing.",
  },
  {
    icon: Route,
    title: "Route",
    description:
      "Smart routing selects optimal endpoints using quadratic score-weighted selection.",
  },
] as const;

export function HowItWorks() {
  return (
    <section className="bg-midnight-plum px-4 py-24 md:py-32">
      {/* Section separator */}
      <div className="h-px bg-gradient-to-r from-transparent via-soft-violet/20 to-transparent" />

      <div className="mx-auto max-w-5xl pt-8">
        <ScrollReveal margin="-120px">
          <h2 className="text-center font-display text-3xl font-bold text-soft-violet md:text-4xl">
            How It Works
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-center text-dusty-lavender/70">
            Three-stage pipeline for chain intelligence.
          </p>
        </ScrollReveal>

        <ScrollReveal stagger className="relative mt-16">
          {/* Connection lines — desktop only */}
          <div className="pointer-events-none absolute inset-0 hidden items-center md:flex">
            <div className="mx-auto flex w-full max-w-3xl justify-between px-20">
              <div className="h-px flex-1 bg-gradient-to-r from-soft-violet/40 to-transparent" />
              <div className="w-16" />
              <div className="h-px flex-1 bg-gradient-to-r from-soft-violet/40 to-transparent" />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-12 md:grid-cols-3 md:gap-8">
            {steps.map((step, i) => (
              <motion.div
                key={step.title}
                variants={staggerItem}
                className="group flex flex-col items-center text-center"
              >
                <div className="relative flex size-16 items-center justify-center rounded-full bg-soft-violet/15 ring-2 ring-soft-violet/30 transition-all group-hover:ring-soft-violet/50 group-hover:scale-110">
                  <step.icon className="size-8 text-soft-violet" />
                  <span className="absolute -right-1 -top-1 flex size-6 items-center justify-center rounded-full bg-soft-violet text-xs font-bold text-white shadow-lg shadow-soft-violet/30">
                    {i + 1}
                  </span>
                </div>
                <h3 className="mt-6 font-display text-xl font-semibold text-dusty-lavender">
                  {step.title}
                </h3>
                <p className="mt-2 max-w-xs text-sm text-dusty-lavender/70">
                  {step.description}
                </p>
              </motion.div>
            ))}
          </div>
        </ScrollReveal>
      </div>
    </section>
  );
}
