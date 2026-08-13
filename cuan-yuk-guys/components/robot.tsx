export function RobotAvatar({ size = 56 }: { size?: number }) {
  return (
    <div
      className="robot-idle relative shrink-0"
      style={{ width: size, height: size }}
      aria-hidden
    >
      <svg viewBox="0 0 80 80" width={size} height={size} fill="none">
        <circle cx="40" cy="40" r="38" fill="#0c0c0c" stroke="rgba(201,162,79,0.45)" strokeWidth="2" />
        <line x1="40" y1="8" x2="40" y2="16" stroke="#d4af77" strokeWidth="2" />
        <circle cx="40" cy="7" r="3.2" fill="#d4af77" className="robot-antenna" />
        <rect x="22" y="20" width="36" height="28" rx="8" fill="#161616" stroke="#d4af77" strokeWidth="1.6" />
        <rect x="26" y="26" width="28" height="12" rx="6" fill="#050505" />
        <circle cx="34" cy="32" r="3.2" fill="#9cba8a" className="robot-eye" />
        <circle cx="46" cy="32" r="3.2" fill="#9cba8a" className="robot-eye" />
        <rect x="32" y="42" width="16" height="3" rx="1.5" fill="#d4af77" opacity="0.7" />
        <rect x="28" y="50" width="24" height="16" rx="5" fill="#161616" stroke="#d4af77" strokeWidth="1.4" />
        <rect x="36" y="54" width="8" height="8" rx="2" fill="#c9a24f" opacity="0.85" />
        <rect x="16" y="52" width="8" height="4" rx="2" fill="#d4af77" />
        <rect x="56" y="52" width="8" height="4" rx="2" fill="#d4af77" />
      </svg>
    </div>
  );
}
