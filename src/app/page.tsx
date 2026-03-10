import dynamic from "next/dynamic";
import { Hero } from "@/components/landing/hero";
import { CallToAction } from "@/components/landing/cta";

const Features = dynamic(
  () => import("@/components/landing/features").then((m) => m.Features),
  { ssr: true }
);
const NetworkStats = dynamic(
  () =>
    import("@/components/landing/network-stats").then((m) => m.NetworkStats),
  { ssr: true }
);
const HowItWorks = dynamic(
  () => import("@/components/landing/how-it-works").then((m) => m.HowItWorks),
  { ssr: true }
);
const ApiTeaser = dynamic(
  () => import("@/components/landing/api-teaser").then((m) => m.ApiTeaser),
  { ssr: true }
);

export default function Home() {
  return (
    <main className="relative min-h-screen bg-midnight-plum">
      <div className="landing-gradient-glow pointer-events-none fixed inset-0" />
      <div className="relative">
        <Hero />
        <Features />
        <NetworkStats />
        <HowItWorks />
        <ApiTeaser />
        <CallToAction />
      </div>
    </main>
  );
}
