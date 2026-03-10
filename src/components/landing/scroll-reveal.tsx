"use client";

import { useRef, type ReactNode } from "react";
import { motion, useInView } from "motion/react";
import { fadeInUp, staggerContainer } from "@/lib/animations";

type UseInViewMargin = `${number}${"px" | "%"}`;
type MarginType =
  | UseInViewMargin
  | `${UseInViewMargin} ${UseInViewMargin}`
  | `${UseInViewMargin} ${UseInViewMargin} ${UseInViewMargin}`
  | `${UseInViewMargin} ${UseInViewMargin} ${UseInViewMargin} ${UseInViewMargin}`;

interface ScrollRevealProps {
  children: ReactNode;
  className?: string;
  delay?: number;
  stagger?: boolean;
  margin?: MarginType;
}

export function ScrollReveal({
  children,
  className,
  delay = 0,
  stagger = false,
  margin = "-80px",
}: ScrollRevealProps) {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin });

  if (stagger) {
    return (
      <motion.div
        ref={ref}
        variants={staggerContainer}
        initial="hidden"
        animate={isInView ? "visible" : "hidden"}
        className={className}
      >
        {children}
      </motion.div>
    );
  }

  return (
    <motion.div
      ref={ref}
      variants={fadeInUp}
      initial="hidden"
      animate={isInView ? "visible" : "hidden"}
      custom={delay}
      className={className}
    >
      {children}
    </motion.div>
  );
}
