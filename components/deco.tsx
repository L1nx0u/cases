export function HandRule() {
  return (
    <svg className="hand-rule" viewBox="0 0 1200 14" preserveAspectRatio="none" aria-hidden="true">
      <path
        d="M2 9 C 120 3, 210 12, 320 7 S 520 2, 640 8 S 880 13, 1000 6 S 1150 4, 1198 8"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function tiltOf(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i += 1) h = (h * 31 + seed.charCodeAt(i)) | 0;
  const angle = ((Math.abs(h) % 17) - 8) / 10;
  return Number(angle.toFixed(2));
}
