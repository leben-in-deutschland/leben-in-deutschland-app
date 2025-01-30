import { User } from "@/types/user";
import { Card, CardBody, CardFooter, CardHeader } from "@heroui/react";
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
} from "chart.js";

ChartJS.register(
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement
);
import { Line } from "react-chartjs-2";

export const ProgressLine = ({ user }: { user: User }) => {
    let todayDate = new Date();

    let labels: string[] = [];
    let data: number[] = [];
    for (let i = 14; i >= 0; i--) {
        let startDate = new Date(todayDate.getTime() - i * 24 * 60 * 60 * 1000);
        let date = startDate.toDateString();
        labels.push(date);
        let index = user.dailyProgress.findIndex(x => new Date(x.date).toDateString() === date);
        if (index > -1) {
            data.push(user.dailyProgress[index].attempted);
        }
        else {
            data.push(0);
        }

    }

    return (
        <div>
            <Card className="card-stats border-none h-[300px]">

                <CardHeader className="justify-between">
                    <h2 className="font-bold text-uppercase text-muted">
                        Daily Progress
                    </h2>
                    <h6 className="text-gray-400"> Past 15 days</h6>
                </CardHeader>
                <CardBody>
                    <Line
                        options={{
                            responsive: true,
                            scales: {
                                x: {
                                    grid: {
                                        display: false,
                                    },
                                    border: {
                                        display: false,
                                    },
                                    ticks: {
                                        display: false,
                                    },
                                },
                                y: {
                                    grid: {
                                        display: false,
                                    },
                                    border: {
                                        display: false,
                                    },
                                    ticks: {
                                        display: false,
                                    },
                                },
                            },
                            plugins: {
                                legend: {
                                    display: false,
                                },

                            },
                        }}

                        data={{
                            labels: labels,
                            datasets: [
                                {
                                    data: data,
                                    backgroundColor: "purple",
                                    borderColor: 'rgb(75, 192, 192)'
                                },
                            ],
                        }}
                    />
                </CardBody>
                <CardFooter>
                    <span className="text-xs text-nowrap">Number of Questions Attempted Over Time</span>
                </CardFooter>
            </Card>
        </div >
    );
};