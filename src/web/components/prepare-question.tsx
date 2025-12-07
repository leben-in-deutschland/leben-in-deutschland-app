import { PrepareQuestionActions } from "@/types/prepare-question";
import { User } from "@/types/user";
import { Card, Tooltip, CardHeader, CardFooter } from "@heroui/react";
import { Question } from "@/types/question";
import { Doughnut } from "react-chartjs-2";
import { ArrowRightIcon } from "@/icons/ArrowRightIcon";
import { useRouter } from "next/navigation";

export default function PrepareQuestion({ questions, user, translation }: { questions: Question[], user: User, translation: any }) {
    const isNumeric = (val: string): boolean => !isNaN(Number(val));

    let allQuestions = questions.filter(x => x?.num.startsWith(user.state.stateCode) || isNumeric(x?.num)).length;
    let attempted = user.questionProgress.filter(x => x?.num.startsWith(user.state.stateCode) || isNumeric(x?.num)).length;

    const router = useRouter()
    return (
        <div className="item-center">
            <Tooltip content="Prepare questions">
                <Card className="card-stats border-none w-[100%]"
                    isPressable
                    onPress={() => router.push("/prepare?action=prepare")}>
                    <CardHeader className="flex justify-between">
                        <div className="flex gap-2 md:gap-10">
                            <h2 className="font-bold text-uppercase text-muted">
                                {translation.dashboard_prepate_button_text}
                            </h2>
                            <div className="flex">
                                <Tooltip content="Attempted">
                                    <span className="text-green-400 font-extrabold md:text-4xl">{attempted}</span>
                                </Tooltip>
                                /
                                <Tooltip content="All Questions">
                                    <span className="text-yellow-500 font-bold">{allQuestions}</span>
                                </Tooltip>
                            </div>

                        </div>
                        <div style={{ width: "5rem" }}>
                            <Doughnut
                                options={{
                                    responsive: true,
                                    aspectRatio: 1.2,
                                    plugins: {
                                        legend: {
                                            display: false,
                                        }
                                    }
                                }}
                                data={{
                                    labels: ["Attempted", "AllQuestions"],
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
                        <div className="justify-end">
                            <ArrowRightIcon size={40} />
                        </div>
                    </CardHeader>
                </Card >
            </Tooltip>
        </div>
    );

}