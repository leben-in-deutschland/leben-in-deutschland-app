import { IconSvgProps } from "../types";

export const ShieldIcon = ({
    size = 24,
    width,
    height,
    ...props
}: IconSvgProps) => (
    <svg
        height={size || height}
        viewBox="0 0 24 24"
        width={size || width}
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        {...props}
    >
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
);
