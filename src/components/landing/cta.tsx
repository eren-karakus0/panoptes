import Link from "next/link";
import { Github, MessageCircle } from "lucide-react";
import { APP_NAME, APP_VERSION } from "@/lib/constants";

export function CallToAction() {
  return (
    <section className="bg-midnight-plum px-4 py-24 md:py-32">
      {/* Section separator */}
      <div className="h-px bg-gradient-to-r from-transparent via-soft-violet/20 to-transparent" />

      <div className="mx-auto max-w-4xl pt-8">
        {/* CTA */}
        <div className="text-center">
          <h2 className="font-display text-3xl font-bold text-soft-violet md:text-4xl">
            Start Monitoring Now
          </h2>
          <p className="mx-auto mt-4 max-w-lg text-dusty-lavender/70">
            Get real-time insights into the Republic AI network. Track
            validators, score endpoints, and route intelligently.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-4">
            <Link
              href="/dashboard"
              className="rounded-lg bg-soft-violet px-6 py-3 text-sm font-bold text-white transition-all hover:bg-deep-iris hover:scale-105 hover:shadow-lg hover:shadow-soft-violet/20"
            >
              Open Dashboard
            </Link>
            <a
              href="https://discord.gg/kNERz4xC"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-lg border border-soft-violet/30 px-6 py-3 text-sm font-medium text-dusty-lavender transition-all hover:scale-105 hover:border-soft-violet hover:bg-soft-violet/10"
            >
              <MessageCircle className="size-4" />
              Join Discord
            </a>
          </div>
        </div>

        {/* Footer */}
        <footer className="mt-20 border-t border-soft-violet/20 pt-8">
          <div className="flex flex-col items-center gap-6 md:flex-row md:justify-between">
            {/* Left */}
            <div className="flex items-center gap-3 text-sm text-mist/50">
              <span className="rounded-md bg-soft-violet/15 px-2 py-0.5 text-xs font-medium text-dusty-lavender">
                v{APP_VERSION}
              </span>
              <span>MIT License</span>
            </div>

            {/* Center — links */}
            <div className="flex items-center gap-4">
              <a
                href="https://github.com/eren-karakus0/panoptes"
                target="_blank"
                rel="noopener noreferrer"
                className="text-mist/50 transition-colors hover:text-soft-violet"
                aria-label="GitHub"
              >
                <Github className="size-5" />
              </a>
              <a
                href="https://discord.gg/kNERz4xC"
                target="_blank"
                rel="noopener noreferrer"
                className="text-mist/50 transition-colors hover:text-soft-violet"
                aria-label="Discord"
              >
                <MessageCircle className="size-5" />
              </a>
            </div>

            {/* Right */}
            <div className="text-sm text-mist/50">
              Built with{" "}
              <a
                href="https://www.npmjs.com/package/republic-sdk"
                target="_blank"
                rel="noopener noreferrer"
                className="text-soft-violet/70 transition-colors hover:text-soft-violet"
              >
                republic-sdk
              </a>
            </div>
          </div>

          <p className="mt-6 text-center text-xs text-mist/30">
            &copy; {new Date().getFullYear()} {APP_NAME}
          </p>
        </footer>
      </div>
    </section>
  );
}
