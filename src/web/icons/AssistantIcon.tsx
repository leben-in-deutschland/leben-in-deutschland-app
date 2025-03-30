import { IconSvgProps } from "@/types";

export const AssistantIcon: React.FC<IconSvgProps> = ({
    size = 24,
    width,
    height,
    ...props
}) => {
    return (
        <svg
            height={size || height}
            viewBox="0 0 192 192"
            width={size || width}
            xmlSpace="preserve"
            xmlns="http://www.w3.org/2000/svg"
            xmlnsXlink="http://www.w3.org/1999/xlink"
            {...props}
        >
            <circle cx="66" cy="70" r="44" stroke="#000000" strokeWidth="12" />
            <circle cx="138" cy="148" r="18" stroke="#000000" strokeWidth="12" />
            <circle cx="167" cy="73" r="9" fill="#000000" />
            <circle cx="138" cy="97" r="13" stroke="#000000" strokeWidth="12" />
        </svg>

    );
};