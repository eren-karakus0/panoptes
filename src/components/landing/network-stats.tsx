"use client";

import { useEffect, useRef } from "react";
import { motion, useInView, useMotionValue, useSpring } from "motion/react";
import { Users, Activity, Coins, Clock } from "lucide-react";
import { useNetworkStats } from "@/hooks/use-stats";
import { tokensToNumber } from "@/lib/formatters";
import { staggerItem } from "@/lib/animations";
import { ScrollReveal } from "./scroll-reveal";

function CountUp({ value, decimals = 0 }: { value: number; decimals?: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const motionValue = useMotionValue(0);
  const springValue = useSpring(motionValue, { duration: 2000, bounce: 0 });
  const isInView = useInView(ref, { once: true });

  useEffect(() => {
    if (isInView) {
      motionValue.set(value);
    }
  }, [isInView, value, motionValue]);

  useEffect(() => {
    const unsubscribe = springValue.on("change", (latest) => {
      if (ref.current) {
        ref.current.textContent =
          decimals > 0
            ? latest.toFixed(decimals)
            : Math.round(latest).toLocaleString();
      }
    });
    return unsubscribe;
  }, [springValue, decimals]);

  return <span ref={ref}>0</span>;
}

function formatStakedForDisplay(araiString: string): { value: number; suffix: string } {
  const rai = tokensToNumber(araiString);
  if (rai >= 1_000_000_000) return { value: rai / 1_000_000_000, suffix: "B RAI" };
  if (rai >= 1_000_000) return { value: rai / 1_000_000, suffix: "M RAI" };
  if (rai >= 1_000) return { value: rai / 1_000, suffix: "K RAI" };
  return { value: rai, suffix: "RAI" };
}

export function NetworkStats() {
  const { data, error, isLoading } = useNetworkStats();

  const stats = data?.current;
  const staked = stats ? formatStakedForDisplay(stats.totalStaked) : null;

  const items = [
    {
      icon: Users,
      label: "Total Validators",
      value: stats?.totalValidators,
      decimals: 0,
    },
    {
      icon: Activity,
      label: "Active Validators",
      value: stats?.activeValidators,
      decimals: 0,
    },
    {
      icon: Coins,
      label: "Total Staked",
      value: staked?.value,
      decimals: 2,
      suffix: staked?.suffix,
    },
    {
      icon: Clock,
      label: "Avg Block Time",
      value: stats?.avgBlockTime ?? undefined,
      decimals: 2,
      suffix: "s",
    },
  ];

  return (
    <section className="bg-[#1a1230] px-4 py-24 md:py-32">
      {/* Section separator */}
      <div className="h-px bg-gradient-to-r from-transparent via-soft-violet/20 to-transparent" />

      <div className="mx-auto max-w-6xl pt-8">
        <ScrollReveal margin="-120px">
          <h2 className="text-center font-display text-3xl font-bold text-dusty-lavender md:text-4xl">
            Live Network Data
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-center text-dusty-lavender/70">
            Real-time metrics from the Republic AI chain.
          </p>
        </ScrollReveal>

        {error && (
          <p className="mt-8 text-center text-sm text-rose-light">
            Failed to load network stats.
          </p>
        )}

        <ScrollReveal
          stagger
          margin="-120px"
          className="mt-16 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4"
        >
          {items.map((item) => (
            <motion.div
              key={item.label}
              variants={staggerItem}
              className="group rounded-xl border border-soft-violet/20 bg-deep-iris/10 p-6 text-center backdrop-blur-sm transition-all hover:border-soft-violet/30 hover:bg-deep-iris/15"
            >
              <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-soft-violet/15 transition-transform group-hover:scale-110">
                <item.icon className="size-6 text-soft-violet" />
              </div>
              <p className="mt-4 text-sm text-dusty-lavender/70">{item.label}</p>
              <p className="mt-2 font-display text-3xl font-bold text-dusty-lavender">
                {isLoading || item.value === undefined ? (
                  <span className="inline-block h-9 w-20 animate-pulse rounded bg-deep-iris/20" />
                ) : (
                  <>
                    <CountUp value={item.value} decimals={item.decimals} />
                    {item.suffix && (
                      <span className="ml-1 text-lg font-normal text-mist/50">
                        {item.suffix}
                      </span>
                    )}
                  </>
                )}
              </p>
            </motion.div>
          ))}
        </ScrollReveal>
      </div>
    </section>
  );
}
