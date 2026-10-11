export const SkipIcon = ({ size = 24, className = "" }: { size?: number; className?: string }) => (
    <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        className={className}
    >
        <polygon points="5 4 15 12 5 20 5 4" />
        <line x1="19" y1="5" x2="19" y2="19" />
    </svg>
);
