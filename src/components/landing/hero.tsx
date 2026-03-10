"use client";

import Image from "next/image";
import Link from "next/link";
import { motion } from "motion/react";
import { ChevronDown, Github } from "lucide-react";
import { APP_NAME, APP_TAGLINE, APP_DESCRIPTION } from "@/lib/constants";
import { fadeInUp, floatingParticle } from "@/lib/animations";

const particles = Array.from({ length: 7 }, (_, i) => i);

export function Hero() {
  return (
    <section className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-midnight-plum px-4 text-center">
      {/* Radial gradient glow */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--color-deep-iris)/10_0%,_transparent_70%)]" />

      {/* Floating particles */}
      {particles.map((i) => (
        <motion.div
          key={i}
          variants={floatingParticle}
          initial="initial"
          animate="animate"
          custom={i}
          className="absolute rounded-full bg-soft-violet/20"
          style={{
            width: 6 + i * 3,
            height: 6 + i * 3,
            left: `${10 + i * 12}%`,
            top: `${20 + (i % 3) * 25}%`,
          }}
        />
      ))}

      {/* Content */}
      <motion.div
        variants={fadeInUp}
        initial="hidden"
        animate="visible"
        custom={0}
        className="relative z-10"
      >
        <Image
          src="/logo.svg"
          alt={`${APP_NAME} logo`}
          width={120}
          height={120}
          className="mx-auto h-20 w-20 md:h-[100px] md:w-[100px] lg:h-[120px] lg:w-[120px]"
          priority
        />
      </motion.div>

      <motion.h1
        variants={fadeInUp}
        initial="hidden"
        animate="visible"
        custom={0.1}
        className="relative z-10 mt-8 font-display text-5xl font-bold tracking-tight md:text-6xl lg:text-7xl"
      >
        <span className="bg-gradient-to-r from-soft-violet to-dusty-lavender bg-clip-text text-transparent">
          {APP_NAME}
        </span>
      </motion.h1>

      <motion.p
        variants={fadeInUp}
        initial="hidden"
        animate="visible"
        custom={0.2}
        className="relative z-10 mt-4 font-display text-lg text-dusty-lavender md:text-xl"
      >
        {APP_TAGLINE}
      </motion.p>

      <motion.p
        variants={fadeInUp}
        initial="hidden"
        animate="visible"
        custom={0.3}
        className="relative z-10 mt-6 max-w-lg text-sm text-mist/70"
      >
        {APP_DESCRIPTION}
      </motion.p>

      <motion.div
        variants={fadeInUp}
        initial="hidden"
        animate="visible"
        custom={0.4}
        className="relative z-10 mt-10 flex gap-4"
      >
        <Link
          href="/dashboard"
          className="rounded-lg bg-soft-violet px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-deep-iris"
        >
          View Dashboard
        </Link>
        <a
          href="https://github.com/eren-karakus0/panoptes"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 rounded-lg border border-dusty-lavender/30 px-6 py-3 text-sm font-medium text-dusty-lavender transition-colors hover:border-soft-violet hover:text-soft-violet"
        >
          <Github className="size-4" />
          GitHub
        </a>
      </motion.div>

      {/* Scroll indicator */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1, duration: 0.5 }}
        className="absolute bottom-8 z-10"
      >
        <motion.div
          animate={{ y: [0, 8, 0] }}
          transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
        >
          <ChevronDown className="size-6 text-dusty-lavender/50" />
        </motion.div>
      </motion.div>
    </section>
  );
}
