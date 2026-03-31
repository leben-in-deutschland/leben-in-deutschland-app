import { CrossIcon } from "@/icons/CrossIcon";
import { TickIcon } from "@/icons/TickIcon";
import { ClockHistoryIcon } from "@/icons/ClockHistoryIcon";
import { User } from "@/types/user";
import { MockTestProgress } from "@/types/user";
import { Card, CardBody, CardHeader, Chip } from "@heroui/react";

function HistoryItem({ entry, translation, onPress }: { entry: MockTestProgress; translation: any; onPress: () => void }) {
    const correct = entry.questions.filter(q => q.answeredCorrectly).length;
    const incorrect = entry.questions.filter(q => !q.answeredCorrectly).length;
    const date = new Date(entry.datetime);
    const timeMins = (Number(entry.timeTake) / 60).toFixed(1);

    const statusColor = entry.cancelled ? "default" : entry.passed ? "success" : "danger";
    const statusBg = entry.cancelled
        ? "bg-default-100 dark:bg-default-50"
        : entry.passed
            ? "bg-success-50 dark:bg-success-50/50"
            : "bg-danger-50 dark:bg-danger-50/50";

    return (
        <button
            type="button"
            disabled={entry.cancelled}
            onClick={() => { if (!entry.cancelled) onPress(); }}
            className={`w-full text-left rounded-xl p-3 ${statusBg} transition-all hover:shadow-sm disabled:opacity-50 disabled:cursor-not-allowed`}
        >
            <div className="flex items-center gap-3">
                {/* Status indicator */}
                <div className={`shrink-0 ${entry.cancelled ? "text-default-400" : entry.passed ? "text-success" : "text-danger"}`}>
                    {entry.passed ? <TickIcon size={28} /> : <CrossIcon size={28} />}
                </div>

                {/* Main content */}
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold text-foreground">
                            {date.toLocaleDateString()}
                        </span>
                        <span className="text-xs text-foreground/40">
                            {date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                        {entry.cancelled && (
                            <Chip size="sm" variant="flat" color="default" className="h-5 text-[10px]">
                                {translation.cancelled}
                            </Chip>
                        )}
                    </div>
                    <div className="flex items-center gap-3 mt-1">
                        <span className="text-xs text-foreground/60">
                            <span className="font-bold text-success">{correct}</span>
                            <span className="text-foreground/30"> / </span>
                            <span className="font-bold text-danger">{incorrect}</span>
                        </span>
                        <span className="text-foreground/20">|</span>
                        <span className="text-xs text-foreground/50">
                            {timeMins} {translation.minutes}
                        </span>
                    </div>
                </div>

                {/* Result chip */}
                {!entry.cancelled && (
                    <Chip
                        size="sm"
                        variant="flat"
                        color={statusColor}
                        className="shrink-0 h-6"
                    >
                        {entry.passed ? translation.passed : translation.failed}
                    </Chip>
                )}
            </div>
        </button>
    );
}

export default function MockHistory({ user, handleHistoryPress, translation }: { user: User, handleHistoryPress: any, translation: any }) {
    const entries = [...user.testProgress].reverse();
    const passedCount = user.testProgress.filter(x => x.passed).length;
    const totalCount = user.testProgress.filter(x => !x.cancelled).length;

    return (
        <Card className="card-stats dashboard-section-enter dashboard-section-enter-5">
            <CardHeader className="flex-col gap-1 pb-2">
                <div className="flex items-center gap-2 w-full justify-center">
                    <div className="bg-warning/10 dark:bg-warning/20 rounded-xl p-2 text-warning">
                        <ClockHistoryIcon size={20} />
                    </div>
                    <h2 className="font-bold text-uppercase text-muted">
                        {translation.dashboard_mock_test_history}
                    </h2>
                </div>
                {totalCount > 0 && (
                    <p className="text-xs text-foreground/50">
                        {passedCount}/{totalCount} {translation.passed}
                    </p>
                )}
            </CardHeader>
            <CardBody className="pt-0">
                <div className="overflow-y-auto scroll-auto max-h-64 flex flex-col gap-2 mock-history-scroll">
                    {entries.map((entry, i) => (
                        <HistoryItem
                            key={entry.datetime + i}
                            entry={entry}
                            translation={translation}
                            onPress={() => handleHistoryPress(entry.datetime)}
                        />
                    ))}
                </div>
            </CardBody>
        </Card>
    );
}
