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
    iconColor: "text-teal-light",
    iconBg: "bg-teal-DEFAULT/20",
  },
  {
    icon: Gauge,
    title: "Endpoint Health",
    description:
      "Continuous health checks. Track latency, uptime, and block freshness.",
    iconColor: "text-teal-light",
    iconBg: "bg-teal-DEFAULT/20",
  },
  {
    icon: Brain,
    title: "Intelligence Layer",
    description:
      "Composite scoring with EMA smoothing for validators and endpoints.",
    iconColor: "text-soft-violet",
    iconBg: "bg-soft-violet/15",
  },
  {
    icon: Route,
    title: "Smart Routing",
    description:
      "Score-weighted endpoint selection with quadratic bias.",
    iconColor: "text-soft-violet",
    iconBg: "bg-soft-violet/15",
  },
  {
    icon: ShieldCheck,
    title: "Preflight Validation",
    description:
      "6-step pre-transaction validation with timeout protection.",
    iconColor: "text-soft-violet",
    iconBg: "bg-soft-violet/15",
  },
  {
    icon: Zap,
    title: "Anomaly Detection",
    description:
      "6 detectors for jailing, stake spikes, commission changes, downtime.",
    iconColor: "text-amber-light",
    iconBg: "bg-amber-DEFAULT/20",
  },
] as const;

export function Features() {
  return (
    <section className="bg-midnight-plum px-4 py-24 md:py-32">
      {/* Section separator */}
      <div className="h-px bg-gradient-to-r from-transparent via-soft-violet/20 to-transparent" />

      <div className="mx-auto max-w-6xl pt-8">
        <ScrollReveal margin="-120px">
          <h2 className="text-center font-display text-3xl font-bold text-soft-violet md:text-4xl">
            Comprehensive Chain Intelligence
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-center text-dusty-lavender/70">
            Everything you need to monitor, score, and interact with the
            Republic AI network.
          </p>
        </ScrollReveal>

        <ScrollReveal
          stagger
          margin="-120px"
          className="mt-16 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3"
        >
          {features.map((feature) => (
            <motion.div
              key={feature.title}
              variants={staggerItem}
              className="group rounded-xl border border-soft-violet/20 bg-deep-iris/10 p-6 backdrop-blur-sm transition-all hover:border-soft-violet/30 hover:bg-deep-iris/15 hover:shadow-lg hover:shadow-soft-violet/5"
            >
              <div className={`flex size-10 items-center justify-center rounded-full ${feature.iconBg} transition-transform group-hover:scale-110`}>
                <feature.icon className={`size-5 ${feature.iconColor}`} />
              </div>
              <h3 className="mt-4 font-display text-lg font-semibold text-dusty-lavender">
                {feature.title}
              </h3>
              <p className="mt-2 text-sm text-dusty-lavender/70">
                {feature.description}
              </p>
            </motion.div>
          ))}
        </ScrollReveal>
      </div>
    </section>
  );
}
