import { User } from "@/types/user";
import { Card, CardBody, CardHeader } from "@nextui-org/react";
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    BarElement,
    Title,
    Tooltip,
    Legend,
} from 'chart.js';

import { Bar } from "react-chartjs-2";
ChartJS.register(
    CategoryScale,
    LinearScale,
    BarElement,
    Title,
    Tooltip,
    Legend
);
export const CorrectIncorrectBar = ({ user }: { user: User }) => {
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
                    Report
                </h2>
                <h6 className="text-gray-400"> Past 30 days</h6>
            </CardHeader>
            <CardBody>
                <Bar
                    options={{
                        responsive: true,

                        plugins: {
                            legend: {
                                position: "top",
                                align: "start",
                                labels: {
                                    boxWidth: 7,
                                    usePointStyle: true,
                                    pointStyle: "circle"
                                },
                            },
                        },

                    }}
                    data={{
                        labels: labels,
                        datasets: [
                            {
                                label: 'Correct',
                                data: correctData,
                                backgroundColor: 'rgba(65, 239, 106, 0.2)',
                                borderColor: "rgba(65, 239, 106, 1)",
                                barThickness: 10,
                                borderRadius: 30,

                                categoryPercentage: 1,
                                borderWidth: 2
                            },
                            {
                                label: 'Incorrect',
                                data: incorrectData,
                                backgroundColor: 'rgba(255, 99, 132, 0.2)',
                                borderColor: "rgba(255, 99, 132, 1)",
                                barThickness: 10,
                                borderRadius: 30,
                                categoryPercentage: 1,
                                borderWidth: 2
                            }]
                    }
                    }
                />
            </CardBody>
        </Card>
    );
};