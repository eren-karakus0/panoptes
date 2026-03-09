import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-midnight-plum text-mist">
      <h1 className="font-display text-8xl font-bold text-soft-violet">404</h1>
      <p className="mt-4 text-lg text-dusty-lavender">Page not found</p>
      <Link
        href="/"
        className="mt-8 rounded-lg bg-deep-iris px-6 py-3 text-sm font-medium text-mist transition-colors hover:bg-soft-violet"
      >
        Back to Home
      </Link>
    </div>
  );
}
