import { IconSvgProps } from "../types";

export const GermanFlagIcon = ({
    size = 24,
    width,
    height,
    ...props
}: IconSvgProps) => (
    <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 72 72"
        height={size || height}
        width={size || width}
        xmlSpace="preserve"
        xmlnsXlink="http://www.w3.org/1999/xlink"
        {...props}
    >
        <path fill="#f1b31c" d="M5 17h62v38H5z" />
        <path fill="#d22f27" d="M5 30h62v12H5z" />
        <path d="M5 17h62v13H5z" />
        <path fill="none" stroke="#000" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 17h62v38H5z" />
    </svg>
);