import Link from "next/link";
import { Github, MessageCircle } from "lucide-react";
import { APP_NAME, APP_VERSION } from "@/lib/constants";

export function CallToAction() {
  return (
    <section className="bg-amber-dark px-4 py-24 md:py-32">
      <div className="mx-auto max-w-4xl">
        {/* CTA */}
        <div className="text-center">
          <h2 className="font-display text-3xl font-bold text-amber-light md:text-4xl">
            Start Monitoring Now
          </h2>
          <p className="mx-auto mt-4 max-w-lg text-mist/70">
            Get real-time insights into the Republic AI network. Track
            validators, score endpoints, and route intelligently.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-4">
            <Link
              href="/dashboard"
              className="rounded-lg bg-amber-DEFAULT px-6 py-3 text-sm font-bold text-amber-dark transition-colors hover:bg-amber-light"
            >
              Open Dashboard
            </Link>
            <a
              href="https://discord.gg/kNERz4xC"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-lg border border-amber-DEFAULT/30 px-6 py-3 text-sm font-medium text-amber-light transition-colors hover:border-amber-light"
            >
              <MessageCircle className="size-4" />
              Join Discord
            </a>
          </div>
        </div>

        {/* Footer */}
        <footer className="mt-20 border-t border-amber-DEFAULT/30 pt-8">
          <div className="flex flex-col items-center gap-6 md:flex-row md:justify-between">
            {/* Left */}
            <div className="flex items-center gap-3 text-sm text-mist/50">
              <span className="rounded-md bg-amber-DEFAULT/20 px-2 py-0.5 text-xs font-medium text-amber-light">
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
                className="text-mist/50 transition-colors hover:text-amber-light"
                aria-label="GitHub"
              >
                <Github className="size-5" />
              </a>
              <a
                href="https://discord.gg/kNERz4xC"
                target="_blank"
                rel="noopener noreferrer"
                className="text-mist/50 transition-colors hover:text-amber-light"
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
                className="text-amber-light/70 transition-colors hover:text-amber-light"
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
