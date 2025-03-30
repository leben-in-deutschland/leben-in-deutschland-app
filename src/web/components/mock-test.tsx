import { ArrowRightIcon } from "@/icons/ArrowRightIcon";
import { User } from "@/types/user";
import { Card, CardHeader, Tooltip } from "@heroui/react";
import { useRouter } from "next/navigation";
import { Doughnut } from "react-chartjs-2";

export default function MockTest({ user, translation }: { user: User, translation: any }) {
    const router = useRouter()
    let passed = user.testProgress.filter(x => x.passed).length;
    let failed = user.testProgress.filter(x => !x.passed).length;
    return (
        <div className="item-center">
            <Tooltip content="Attempt mock exam">
                <Card className="card-stats border-none item-center w-[100%]"
                    isPressable
                    onPress={() => router.push("/mock?action=mock")}>
                    <CardHeader className="flex justify-between">
                        <div className="flex gap-2 md:gap-10">
                            <h2 className="font-bold text-uppercase text-muted">
                                {translation.dashboard_mock_button_text}
                            </h2>
                            <p className="flex">
                                <Tooltip content="Passed">
                                    <h2 className="text-green-400 font-extrabold md:text-4xl">{passed}</h2>
                                </Tooltip>
                                /
                                <Tooltip content="Failed">
                                    <h2 className="text-red-500 font-bold">{failed}</h2>
                                </Tooltip>
                            </p>

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
                                    labels: ["Passed", "Failed"],
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
                        <div className="justify-end">
                            <ArrowRightIcon size={40} />
                        </div>
                    </CardHeader>
                </Card>
            </Tooltip>
        </div>
    );

}