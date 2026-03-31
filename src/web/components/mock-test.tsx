import { ArrowRightIcon } from "@/icons/ArrowRightIcon";
import { ClipboardCheckIcon } from "@/icons/ClipboardCheckIcon";
import { User } from "@/types/user";
import { Card, CardHeader, Tooltip } from "@heroui/react";
import { useRouter } from "next/navigation";
import { Doughnut } from "react-chartjs-2";

export default function MockTest({ user, translation }: { user: User, translation: any }) {
    const router = useRouter()
    let passed = user.testProgress.filter(x => x.passed).length;
    let failed = user.testProgress.filter(x => !x.passed).length;
    return (
        <div className="item-center dashboard-section-enter dashboard-section-enter-3">
            <Tooltip content={translation.attempt_mock_exam ?? "Attempt mock exam"}>
                <Card className="group card-stats border-none item-center w-[100%] hover:shadow-md transition-shadow"
                    isPressable
                    onPress={() => router.push("/mock?action=mock")}>
                    <CardHeader className="flex justify-between items-center">
                        <div className="flex gap-3 md:gap-6 items-center">
                            <div className="bg-secondary/10 dark:bg-secondary/20 rounded-xl p-2.5 text-secondary">
                                <ClipboardCheckIcon size={22} className="dashboard-section-icon" />
                            </div>
                            <div className="flex flex-col">
                                <h2 className="font-bold text-uppercase text-muted text-sm">
                                    {translation.dashboard_mock_button_text}
                                </h2>
                                <div className="flex items-baseline gap-0.5">
                                    <Tooltip content={translation.passed ?? "Passed"}>
                                        <span className="text-success font-extrabold text-xl md:text-3xl">{passed}</span>
                                    </Tooltip>
                                    <span className="text-foreground/40">/</span>
                                    <Tooltip content={translation.failed ?? "Failed"}>
                                        <span className="text-danger font-bold text-sm">{failed}</span>
                                    </Tooltip>
                                </div>
                            </div>
                        </div>
                        <div className="flex items-center gap-3">
                            <div style={{ width: "4.5rem" }}>
                                <Doughnut
                                    options={{
                                        responsive: true,
                                        aspectRatio: 1,
                                        plugins: {
                                            legend: {
                                                display: false,
                                            }
                                        }
                                    }}
                                    data={{
                                        labels: [translation.passed ?? "Passed", translation.failed ?? "Failed"],
                                        datasets: [
                                            {
                                                data: [passed, failed],
                                                borderWidth: 1,
                                                backgroundColor: [
                                                    'rgba(65, 239, 106, 0.2)',
                                                    'rgba(255, 99, 132, 0.2)'
                                                ],
                                                borderColor: [
                                                    'rgba(65, 239, 106, 1)',
                                                    'rgba(255, 99, 132, 1)',
                                                ],
                                            },
                                        ],
                                    }}
                                />
                            </div>
                            <div className="text-foreground/40 group-hover:text-foreground transition-colors">
                                <ArrowRightIcon size={28} />
                            </div>
                        </div>
                    </CardHeader>
                </Card>
            </Tooltip>
        </div>
    );

}
