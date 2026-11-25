import clsx from "clsx";

type FlagSize = "sm" | "md";

/** 5:3, like most of the states' flags; the few others are cropped by a pixel or two. */
const BOX: Record<FlagSize, { className: string; width: number; height: number }> = {
    sm: { className: "h-[18px] w-[30px] rounded-[3px]", width: 30, height: 18 },
    md: { className: "h-6 w-10 rounded", width: 40, height: 24 },
};

type FlagProps = {
    /** "sm" inside an entry of a list, "md" beside a heading. */
    size?: FlagSize;
    /** On a coloured ground, e.g. the selected entry: the hairline is light. */
    onColor?: boolean;
    className?: string;
};

/** The hairline lets a white stripe show on a white ground. */
function boxClass(size: FlagSize, onColor: boolean, className?: string): string {
    return clsx(BOX[size].className, "shrink-0 overflow-hidden ring-1", onColor ? "ring-white/40" : "ring-foreground/15", className);
}

/** A state's flag. The state's name always stands beside it, so the picture says nothing to a screen reader. */
export function StateFlag({ name, size = "sm", onColor = false, className }: FlagProps & { name: string }) {
    return (
        // Static SVG from /public; next/image is not used in the static export.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={`/states/flag/${name}.svg`} alt="" width={BOX[size].width} height={BOX[size].height} loading="lazy" decoding="async" className={boxClass(size, onColor, clsx("object-cover", className))} />
    );
}

/** Black, red, gold: every state together. Drawn, no picture file. */
export function GermanFlag({ size = "sm", onColor = false, className }: FlagProps) {
    return (
        <span aria-hidden="true" data-flag="de" className={boxClass(size, onColor, clsx("flex flex-col", className))}>
            <span className="flex-1 bg-black" />
            <span className="flex-1 bg-[#dd0000]" />
            <span className="flex-1 bg-[#ffce00]" />
        </span>
    );
}
