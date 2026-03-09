import { APP_NAME, APP_TAGLINE, APP_DESCRIPTION } from "@/lib/constants";

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-midnight-plum text-mist">
      <div className="text-center">
        <h1 className="font-display text-6xl font-bold tracking-tight text-soft-violet">
          {APP_NAME}
        </h1>
        <p className="mt-4 font-display text-xl text-dusty-lavender">
          {APP_TAGLINE}
        </p>
        <p className="mt-6 max-w-lg text-sm text-dusty-lavender/70">
          {APP_DESCRIPTION}
        </p>
        <div className="mt-10 flex gap-4 justify-center">
          <a
            href="/dashboard"
            className="rounded-lg bg-soft-violet px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-deep-iris"
          >
            Dashboard
          </a>
          <a
            href="https://github.com/eren-karakus0/panoptes"
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-lg border border-dusty-lavender/30 px-6 py-3 text-sm font-medium text-dusty-lavender transition-colors hover:border-soft-violet hover:text-soft-violet"
          >
            GitHub
          </a>
        </div>
      </div>
    </div>
  );
}
