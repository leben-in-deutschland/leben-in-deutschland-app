import { User } from "@/types/user";
import { Card, CardBody, CardHeader } from "@heroui/react";
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    BarElement,
    Title,
    Tooltip,
    Legend,
} from 'chart.js';

import { Line } from "react-chartjs-2";
ChartJS.register(
    CategoryScale,
    LinearScale,
    BarElement,
    Title,
    Tooltip,
    Legend
);
export const CorrectIncorrectLine = ({ user, translation }: { user: User, translation: any }) => {
    let todayDate = new Date();

    let labels: string[] = [];
    let correctData: number[] = [];
    let incorrectData: number[] = [];
    for (let i = 29; i >= 0; i--) {
        let startDate = new Date(todayDate.getTime() - i * 24 * 60 * 60 * 1000);
        let date = startDate.toDateString();
        labels.push(date);
        let index = user.dailyProgress.findIndex(x => new Date(x.date).toDateString() === date);
        if (index > -1) {
            correctData.push(user.dailyProgress[index].correct);
            incorrectData.push(user.dailyProgress[index].incorrect);
        }
        else {
            correctData.push(0);
            incorrectData.push(0);
        }

    }
    return (
        <Card className="card-stats border-none">
            <CardHeader className="justify-between">
                <h2 className="font-bold text-uppercase text-muted">
                    {translation.correct_incorrect_title}
                </h2>
                <h6 className="text-gray-400">{translation.correct_incorrect_subtitle}</h6>
            </CardHeader>
            <CardBody>
                <Line
                    options={{
                        responsive: true,
                        scales: {
                            x: {
                                display: false
                            },
                            y: {
                                display: false
                            }
                        },
                        plugins: {
                            legend: {
                                position: "top",
                            },
                            title: {
                                display: true,
                                text: `${translation.correct_incorrect_title}`,
                            },
                        },
                    }}
                    data={{
                        labels: labels,
                        datasets: [
                            {
                                label: `${translation.correct}`,
                                data: correctData,
                                backgroundColor: 'rgba(65, 239, 106, 0.2)',
                                borderColor: "rgba(65, 239, 106, 1)",
                                borderWidth: 2

                            },
                            {
                                label: `${translation.incorrect}`,
                                data: incorrectData,
                                backgroundColor: 'rgba(255, 99, 132, 0.2)',
                                borderColor: "rgba(255, 99, 132, 1)",
                                borderWidth: 2
                            }]
                    }
                    }
                />
            </CardBody>
        </Card>
    );
};