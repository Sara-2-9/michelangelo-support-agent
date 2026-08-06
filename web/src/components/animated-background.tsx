/**
 * Animated gradient background — restyle step 1.
 *
 * Pure CSS, zero dependencies: large blurred color blobs (the four brand
 * gradient colors) drift slowly over a soft base wash. Animations are
 * transform-only (GPU-cheap) and freeze entirely when the user prefers
 * reduced motion. Decorative only — hidden from assistive technology.
 */
export default function AnimatedBackground() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <div className="blob-a absolute -left-[15%] -top-[20%] h-[65vmax] w-[65vmax] rounded-full bg-grad-blue opacity-80 blur-[120px]" />
      <div className="blob-b absolute -right-[20%] top-[10%] h-[55vmax] w-[55vmax] rounded-full bg-grad-pink opacity-70 blur-[120px]" />
      <div className="blob-c absolute bottom-[-25%] left-[20%] h-[50vmax] w-[50vmax] rounded-full bg-grad-lilac opacity-60 blur-[120px]" />
    </div>
  );
}
