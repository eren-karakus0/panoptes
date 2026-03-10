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
    <section className="bg-rose-dark px-4 py-24 md:py-32">
      <div className="mx-auto max-w-5xl">
        <ScrollReveal>
          <h2 className="text-center font-display text-3xl font-bold text-rose-light md:text-4xl">
            How It Works
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-center text-mist/70">
            Three-stage pipeline for chain intelligence.
          </p>
        </ScrollReveal>

        <ScrollReveal stagger className="relative mt-16">
          {/* Connection lines — desktop only */}
          <div className="pointer-events-none absolute inset-0 hidden items-center md:flex">
            <div className="mx-auto flex w-full max-w-3xl justify-between px-20">
              <div className="h-px flex-1 bg-gradient-to-r from-rose-DEFAULT to-transparent" />
              <div className="w-16" />
              <div className="h-px flex-1 bg-gradient-to-r from-rose-DEFAULT to-transparent" />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-12 md:grid-cols-3 md:gap-8">
            {steps.map((step, i) => (
              <motion.div
                key={step.title}
                variants={staggerItem}
                className="flex flex-col items-center text-center"
              >
                <div className="relative flex size-16 items-center justify-center rounded-full bg-rose-DEFAULT/20">
                  <step.icon className="size-8 text-rose-light" />
                  <span className="absolute -right-1 -top-1 flex size-6 items-center justify-center rounded-full bg-rose-DEFAULT text-xs font-bold text-white">
                    {i + 1}
                  </span>
                </div>
                <h3 className="mt-6 font-display text-xl font-semibold text-rose-light">
                  {step.title}
                </h3>
                <p className="mt-2 max-w-xs text-sm text-mist/70">
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
