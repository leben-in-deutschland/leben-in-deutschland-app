import { User } from "@/types/user";
import { Card, Tooltip, CardHeader } from "@heroui/react";
import { Question } from "@/types/question";
import { Doughnut } from "react-chartjs-2";
import { ArrowRightIcon } from "@/icons/ArrowRightIcon";
import { BookOpenIcon } from "@/icons/BookOpenIcon";
import { useRouter } from "next/navigation";
import { navigateTo } from "@/utils/navigation";

export default function PrepareQuestion({ questions, user, translation }: { questions: Question[], user: User, translation: any }) {
    const isNumeric = (val: string): boolean => !isNaN(Number(val));

    let allQuestions = questions.filter(x => x?.num.startsWith(user.state.stateCode) || isNumeric(x?.num)).length;
    let attempted = user.questionProgress.filter(x => x?.num.startsWith(user.state.stateCode) || isNumeric(x?.num)).length;

    const router = useRouter()
    return (
        <div className="item-center dashboard-section-enter dashboard-section-enter-2">
            <Tooltip content={translation.prepare_questions ?? "Prepare questions"}>
                <Card className="group card-stats border-none w-[100%] hover:shadow-md transition-shadow"
                    isPressable
                    onPress={() => navigateTo("/prepare?action=prepare", router.push)}>
                    <CardHeader className="flex justify-between items-center">
                        <div className="flex gap-3 md:gap-6 items-center">
                            <div className="bg-primary/10 dark:bg-primary/20 rounded-xl p-2.5 text-primary">
                                <BookOpenIcon size={22} className="dashboard-section-icon" />
                            </div>
                            <div className="flex flex-col">
                                <h2 className="font-bold text-uppercase text-muted text-sm">
                                    {translation.dashboard_prepate_button_text}
                                </h2>
                                <div className="flex items-baseline gap-0.5">
                                    <Tooltip content={translation.attempted ?? "Attempted"}>
                                        <span className="text-success font-extrabold text-xl md:text-3xl">{attempted}</span>
                                    </Tooltip>
                                    <span className="text-foreground/40">/</span>
                                    <Tooltip content={translation.all_questions ?? "All Questions"}>
                                        <span className="text-warning font-bold text-sm">{allQuestions}</span>
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
                                        labels: [translation.attempted ?? "Attempted", translation.all_questions ?? "AllQuestions"],
                                        datasets: [
                                            {
                                                data: [attempted, (allQuestions - attempted)],
                                                borderWidth: 1,
                                                backgroundColor: [
                                                    'rgba(45, 192, 84, 0.2)',
                                                    'rgba(244, 230, 168, 0.2)',
                                                ],
                                                borderColor: [
                                                    'rgba(45, 192, 84, 1)',
                                                    'rgba(244, 230, 168, 1)',
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
                </Card >
            </Tooltip>
        </div>
    );

}
