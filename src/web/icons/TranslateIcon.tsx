import { IconSvgProps } from "@/src/types";

export const TranslateIcon: React.FC<IconSvgProps> = ({
    size = 24,
    width,
    height,
    ...props
}) => {
    return (
        <svg
            height={size || height}
            viewBox="0 0 48 48"
            width={size || width}
            xmlSpace="preserve"
            xmlns="http://www.w3.org/2000/svg"
            xmlnsXlink="http://www.w3.org/1999/xlink"
            {...props}
        >
            <line fill="none" stroke="#000000" strokeLinecap="round" strokeLinejoin="round"
                x1="12.62" y1="24.31" x2="17.94" y2="11.42" />
            <line fill="none" stroke="#000000" strokeLinecap="round" strokeLinejoin="round" x1="23.04" y1="24.35" x2="17.94" y2="11.42" />
            <line fill="none" stroke="#000000" strokeLinecap="round" strokeLinejoin="round" x1="21.34" y1="20.02" x2="14.39" y2="20.02" />
            <g>
                <line fill="none" stroke="#000000" strokeLinecap="round" strokeLinejoin="round" x1="32.63" y1="25.38" x2="39.35" y2="25.38" />
                <path fill="none" stroke="#000000" strokeLinecap="round" strokeLinejoin="round" d="M35.68,25.38c0,4.34-5.29,11.51-10.59,12.61" />
                <path fill="none" stroke="#000000" strokeLinecap="round" strokeLinejoin="round" d="M27.93,32.79c2.13,2.4,5.61,4.74,8.82,5.2" />
            </g>
            <rect fill="none" stroke="#000000" strokeLinecap="round" strokeLinejoin="round" x="5.5" y="5.5" width="24.67" height="24.67" rx="3.64" ry="3.64" />
            <path fill="none" stroke="#000000" strokeLinecap="round" strokeLinejoin="round" d="M17.83,30.17v8.69c0,2,1.64,3.64,3.64,3.64h17.38c2,0,3.64-1.64,3.64-3.64V21.47c0-2-1.64-3.64-3.64-3.64h-8.69" />
        </svg >

    );
};