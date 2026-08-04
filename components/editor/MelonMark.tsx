export function MelonMark({ className, size = 22 }: { className?: string; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <path
        d="M12 3 L20 16.5 A2.4 2.4 0 0 1 17.9 20H6.1A2.4 2.4 0 0 1 4 16.5 L12 3Z"
        fill="#fbbf24"
        stroke="#4ade80"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <circle cx="9.4" cy="12" r="0.9" fill="#78350f" />
      <circle cx="14.6" cy="12" r="0.9" fill="#78350f" />
      <circle cx="12" cy="15.6" r="0.9" fill="#78350f" />
    </svg>
  );
}
