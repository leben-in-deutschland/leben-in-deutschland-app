import { User } from "@/types/user";
import { Card, CardBody } from "@heroui/react";
import { calculateStreak } from "@/utils/stats-logic";
import { calculateExamReadiness } from "@/utils/exam-readiness-logic";
import { BookOpenIcon } from "@/icons/BookOpenIcon";
import { FlameIcon } from "@/icons/FlameIcon";
import { TargetIcon } from "@/icons/TargetIcon";

function getGreetingKey(hour: number): string {
    if (hour < 12) return "greeting_morning";
    if (hour < 18) return "greeting_afternoon";
    return "greeting_evening";
}

function getGreetingEmoji(hour: number): string {
    if (hour < 12) return "☀️";
    if (hour < 18) return "🌤️";
    return "🌙";
}

export default function DashboardGreeting({ user, totalQuestions, translation }: { user: User; totalQuestions: number; translation: any }) {
    const hour = new Date().getHours();
    const greetingKey = getGreetingKey(hour);
    const greeting = translation[greetingKey];
    const emoji = getGreetingEmoji(hour);

    const isNumeric = (val: string): boolean => !isNaN(Number(val));
    const attempted = user.questionProgress?.filter(q => q.answeredCorrectly !== null && (q.num.startsWith(user.state.stateCode) || isNumeric(q.num))).length ?? 0;
    const streak = calculateStreak(user);
    const readiness = Math.round(calculateExamReadiness(user.testProgress ?? []));
    const progress = totalQuestions > 0 ? Math.round((attempted / totalQuestions) * 100) : 0;

    return (
        <Card className="dashboard-greeting-card shadow-none border-none overflow-hidden">
            <CardBody className="p-0">
                {/* Greeting header with decorative background */}
                <div className="relative px-5 pt-5 pb-4 overflow-hidden">
                    {/* Decorative floating circles */}
                    <div className="absolute -top-6 -right-6 w-24 h-24 rounded-full bg-warning/10 dark:bg-warning/5 dashboard-float" />
                    <div className="absolute top-10 -right-2 w-12 h-12 rounded-full bg-primary/10 dark:bg-primary/5 dashboard-float-delayed" />
                    <div className="absolute -bottom-4 right-16 w-16 h-16 rounded-full bg-success/10 dark:bg-success/5 dashboard-float-slow" />

                    <div className="relative flex items-center gap-3">
                        <span className="text-3xl dashboard-wave">{emoji}</span>
                        <div>
                            <h2 className="text-xl font-bold text-foreground">
                                {greeting}
                            </h2>
                        </div>
                    </div>

                    {/* Progress bar */}
                    <div className="relative mt-4">
                        <div className="flex justify-between items-center mb-1.5">
                            <span className="text-xs font-medium text-foreground/60">{translation.greeting_overall_progress}</span>
                            <span className="text-xs font-bold text-foreground">{progress}%</span>
                        </div>
                        <div className="h-2 bg-default-200 dark:bg-default-100 rounded-full overflow-hidden">
                            <div
                                className="h-full rounded-full bg-gradient-to-r from-primary to-success transition-all duration-1000 ease-out dashboard-progress-bar"
                                style={{ width: `${progress}%` }}
                            />
                        </div>
                    </div>
                </div>

                {/* Stats row */}
                <div className="grid grid-cols-3 gap-px bg-default-200 dark:bg-default-100">
                    <div className="bg-background px-3 py-3 text-center flex flex-col items-center gap-1.5">
                        <div className="text-primary">
                            <BookOpenIcon size={20} className="dashboard-icon-pop" />
                        </div>
                        <p className="text-lg font-extrabold text-foreground leading-none">{attempted}<span className="text-[10px] font-normal text-foreground/50">/{totalQuestions}</span></p>
                        <p className="text-[10px] text-foreground/60 leading-tight">{translation.greeting_questions_attempted}</p>
                    </div>
                    <div className="bg-background px-3 py-3 text-center flex flex-col items-center gap-1.5">
                        <div className="text-warning">
                            <FlameIcon size={20} className="dashboard-icon-pop dashboard-icon-pop-delay-1" />
                        </div>
                        <p className="text-lg font-extrabold text-foreground leading-none">{streak}</p>
                        <p className="text-[10px] text-foreground/60 leading-tight">{translation.greeting_streak}</p>
                    </div>
                    <div className="bg-background px-3 py-3 text-center flex flex-col items-center gap-1.5">
                        <div className={readiness >= 75 ? "text-success" : "text-danger"}>
                            <TargetIcon size={20} className="dashboard-icon-pop dashboard-icon-pop-delay-2" />
                        </div>
                        <p className="text-lg font-extrabold text-foreground leading-none">{readiness}%</p>
                        <p className="text-[10px] text-foreground/60 leading-tight">{translation.greeting_readiness}</p>
                    </div>
                </div>
            </CardBody>
        </Card>
    );
}
