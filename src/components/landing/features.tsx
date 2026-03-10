"use client";

import { motion } from "motion/react";
import {
  Activity,
  Gauge,
  Brain,
  Route,
  ShieldCheck,
  Zap,
} from "lucide-react";
import { staggerItem } from "@/lib/animations";
import { ScrollReveal } from "./scroll-reveal";

const features = [
  {
    icon: Activity,
    title: "Validator Monitoring",
    description:
      "Real-time tracking with historical snapshots and stake change detection.",
  },
  {
    icon: Gauge,
    title: "Endpoint Health",
    description:
      "Continuous health checks. Track latency, uptime, and block freshness.",
  },
  {
    icon: Brain,
    title: "Intelligence Layer",
    description:
      "Composite scoring with EMA smoothing for validators and endpoints.",
  },
  {
    icon: Route,
    title: "Smart Routing",
    description:
      "Score-weighted endpoint selection with quadratic bias.",
  },
  {
    icon: ShieldCheck,
    title: "Preflight Validation",
    description:
      "6-step pre-transaction validation with timeout protection.",
  },
  {
    icon: Zap,
    title: "Anomaly Detection",
    description:
      "6 detectors for jailing, stake spikes, commission changes, downtime.",
  },
] as const;

export function Features() {
  return (
    <section className="bg-teal-dark px-4 py-24 md:py-32">
      <div className="mx-auto max-w-6xl">
        <ScrollReveal>
          <h2 className="text-center font-display text-3xl font-bold text-teal-light md:text-4xl">
            Comprehensive Chain Intelligence
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-center text-mist/70">
            Everything you need to monitor, score, and interact with the
            Republic AI network.
          </p>
        </ScrollReveal>

        <ScrollReveal
          stagger
          className="mt-16 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3"
        >
          {features.map((feature) => (
            <motion.div
              key={feature.title}
              variants={staggerItem}
              className="rounded-xl border border-teal-DEFAULT/30 bg-teal-dark/50 p-6 transition-colors hover:border-teal-DEFAULT"
            >
              <div className="flex size-10 items-center justify-center rounded-full bg-teal-DEFAULT/20">
                <feature.icon className="size-5 text-teal-light" />
              </div>
              <h3 className="mt-4 font-display text-lg font-semibold text-teal-light">
                {feature.title}
              </h3>
              <p className="mt-2 text-sm text-mist/70">
                {feature.description}
              </p>
            </motion.div>
          ))}
        </ScrollReveal>
      </div>
    </section>
  );
}
