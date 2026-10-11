import clsx from "clsx";

export type TrendPoint = {
    value: number;
    passed: boolean;
    /** Hover text, e.g. "9 Oct 2026: 21 of 33". */
    title: string;
};

type TrendChartProps = {
    /** Oldest first. */
    points: TrendPoint[];
    /** Top of the scale, e.g. 33. */
    max: number;
    passMark: number;
    passMarkLabel: string;
    /** Accessible summary of the chart. */
    label: string;
    startLabel?: string;
    endLabel?: string;
    className?: string;
};

function clamp01(value: number): number {
    return Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0;
}

/**
 * Small line chart of exam scores. The line is an SVG stretched over the box
 * (strokes keep their width); the dots and labels are HTML so they never
 * distort and scale with the text.
 */
export function TrendChart({ points, max, passMark, passMarkLabel, label, startLabel, endLabel, className }: TrendChartProps) {
    const count = points.length;
    const xAt = (index: number) => (count <= 1 ? 50 : (index / (count - 1)) * 100);
    const yAt = (value: number) => 100 - clamp01(value / max) * 100;
    const coords = points.map((point, index) => [xAt(index), yAt(point.value)] as const);
    const line = coords.map(([x, y], index) => `${index === 0 ? "M" : "L"} ${x} ${y}`).join(" ");
    const area =
        coords.length > 0 ? `${line} L ${coords[coords.length - 1][0]} 100 L ${coords[0][0]} 100 Z` : "";
    const passY = yAt(passMark);

    return (
        <figure className={className} role="img" aria-label={label}>
            <div className="relative pt-5">
                <div className="relative mx-3 h-28 sm:h-32">
                    <div className="pointer-events-none absolute inset-x-0 border-t border-dashed border-default-400" style={{ top: `${passY}%` }} aria-hidden="true">
                        <span className="absolute right-0 -top-0.5 -translate-y-full rounded bg-content1 px-1 text-[11px] font-medium leading-tight text-default-500">
                            {passMarkLabel}
                        </span>
                    </div>
                    <svg className="absolute inset-0 h-full w-full overflow-visible" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
                        {area ? <path d={area} className="fill-current text-primary/10" /> : null}
                        {count > 1 ? (
                            <path
                                d={line}
                                fill="none"
                                stroke="currentColor"
                                strokeWidth={2}
                                strokeLinejoin="round"
                                strokeLinecap="round"
                                vectorEffect="non-scaling-stroke"
                                className="text-primary"
                            />
                        ) : null}
                    </svg>
                    {points.map((point, index) => (
                        <div
                            key={`${index}-${point.value}`}
                            className="absolute -translate-x-1/2 -translate-y-1/2"
                            style={{ left: `${coords[index][0]}%`, top: `${coords[index][1]}%` }}
                            title={point.title}
                        >
                            <span className="absolute left-1/2 top-0 -translate-x-1/2 -translate-y-[calc(100%+6px)] text-[11px] font-semibold tabular leading-none text-default-600">
                                {point.value}
                            </span>
                            <span
                                className={clsx(
                                    "block h-3 w-3 rounded-full border-2 border-content1 shadow-card",
                                    point.passed ? "bg-success" : "bg-danger",
                                )}
                            />
                        </div>
                    ))}
                </div>
            </div>
            {startLabel || endLabel ? (
                <figcaption className="mt-2 flex justify-between gap-2 text-xs text-default-500">
                    <span>{startLabel}</span>
                    <span>{endLabel}</span>
                </figcaption>
            ) : null}
        </figure>
    );
}
