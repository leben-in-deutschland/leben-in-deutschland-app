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
                        scales: {
                            xAxis: {
                                display: false,
                            }
                        }
                    }}
                    data={{
                        labels: ['January', 'February', 'March', 'April', 'May', 'June', 'July'],
                        datasets: [
                            {
                                label: 'Correct',
                                data: [1, 2, 3, 4, 5, 6, 7],
                                backgroundColor: 'rgba(65, 239, 106, 0.2)',
                                borderColor: "rgba(65, 239, 106, 1)",
                                barThickness: 10,
                                borderRadius: 30,
                                barPercentage: 0.3,
                                categoryPercentage: 1,
                                borderWidth: 2
                            },
                            {
                                label: 'Incorrect',
                                data: [1, 2, 1, 3, 41, 2, 3],
                                backgroundColor: 'rgba(255, 99, 132, 0.2)',
                                borderColor: "rgba(255, 99, 132, 1)",
                                barThickness: 10,
                                borderRadius: 30,
                                barPercentage: 0.3,
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