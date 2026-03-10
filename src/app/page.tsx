import { Hero } from "@/components/landing/hero";
import { Features } from "@/components/landing/features";
import { NetworkStats } from "@/components/landing/network-stats";
import { HowItWorks } from "@/components/landing/how-it-works";
import { ApiTeaser } from "@/components/landing/api-teaser";
import { CallToAction } from "@/components/landing/cta";

export default function Home() {
  return (
    <main className="min-h-screen">
      <Hero />
      <Features />
      <NetworkStats />
      <HowItWorks />
      <ApiTeaser />
      <CallToAction />
    </main>
  );
}
