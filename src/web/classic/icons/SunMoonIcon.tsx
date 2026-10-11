import { IconSvgProps } from "../types";

export const SunMoonIcon = ({
    size = 24,
    width,
    height,
    ...props
}: IconSvgProps) => (
    <svg
        height={size || height}
        viewBox="0 0 32 32"
        width={size || width}
        {...props}
    >
        <circle fill="currentColor"
            clipRule="evenodd"
            fillRule="evenodd"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeMiterlimit="10"
            cx="21" cy="16" r="8" />
        <line fill="currentColor"
            clipRule="evenodd"
            fillRule="evenodd"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeMiterlimit="10" x1="14" y1="5" x2="14" y2="6" />
        <line fill="currentColor"
            clipRule="evenodd"
            fillRule="evenodd"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeMiterlimit="10" x1="4.81" y1="6.81" x2="6.93" y2="8.93" />
        <line fill="currentColor"
            clipRule="evenodd"
            fillRule="evenodd"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeMiterlimit="10" x1="3" y1="16" x2="4" y2="16" />
        <line fill="currentColor"
            clipRule="evenodd"
            fillRule="evenodd"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeMiterlimit="10" x1="4.81" y1="25.19" x2="6.93" y2="23.07" />
        <line fill="currentColor"
            clipRule="evenodd"
            fillRule="evenodd"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeMiterlimit="10" x1="14" y1="27" x2="14" y2="26" />
        <path fill="currentColor"
            clipRule="evenodd"
            fillRule="evenodd"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeMiterlimit="10" d="M16.43,22.57C15.67,22.85,14.85,23,14,23c-3.87,0-7-3.13-7-7s3.13-7,7-7c0.85,0,1.67,0.15,2.43,0.43" />
    </svg>
);