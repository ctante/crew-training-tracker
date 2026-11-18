import Link from "next/link";

export default function NotFound() {
  return (
    <div className="py-16">
      <h1 className="font-display text-4xl">That page is not on the board</h1>
      <p className="mt-2 text-ink/70">The trainee may have been removed.</p>
      <Link href="/" className="mt-4 inline-flex min-h-11 items-center rounded-full bg-brick px-4 text-sm font-semibold text-white">
        Back to the board
      </Link>
    </div>
  );
}
