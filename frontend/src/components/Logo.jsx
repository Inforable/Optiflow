export default function Logo({ compact = false, className = '' }) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <svg width="28" height="28" viewBox="0 0 64 64" aria-hidden>
        <rect width="64" height="64" rx="14" fill="#151A23" stroke="#232D3F" />
        <path d="M32 11 C 26 21, 19 28, 19 37 a13 13 0 0 0 26 0 C 45 28, 38 21, 32 11 Z" fill="#06B6D4" />
        <circle cx="27" cy="36" r="3" fill="#A5F3FC" />
      </svg>
      {!compact && (
        <span className="text-base font-bold italic tracking-tight">
          <span className="text-white">Lube</span>
          <span className="text-accent-cyan">Guard</span>
        </span>
      )}
    </span>
  );
}
