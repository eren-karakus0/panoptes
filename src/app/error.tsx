"use client";

export default function Error({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-midnight-plum text-mist">
      <h1 className="font-display text-4xl font-bold text-rose-DEFAULT">
        Something went wrong
      </h1>
      <p className="mt-4 text-dusty-lavender/70">
        An unexpected error occurred.
      </p>
      <button
        onClick={reset}
        className="mt-8 rounded-lg bg-deep-iris px-6 py-3 text-sm font-medium text-mist transition-colors hover:bg-soft-violet"
      >
        Try Again
      </button>
    </div>
  );
}
