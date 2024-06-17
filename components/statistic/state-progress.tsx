import { Card, CardBody, CardHeader, Image } from "@nextui-org/react"
import { Doughnut } from "react-chartjs-2";
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js';
ChartJS.register(ArcElement, Tooltip, Legend);
export const StateProgress = ({ stateName }: { stateName: string }) => {
    return (
        <div style={{ width: "18rem" }}>
            <Card className="card-stats border-none h-[300px]">
                <CardHeader className="justify-between">
                    <h2 className="font-bold text-uppercase text-muted">
                        {stateName}
                    </h2>
                    <div className="text-gray-400">
                        <Image
                            alt={stateName}
                            className="object-cover justify-center items-center"
                            src={`/states/coat-of-arms/${stateName}.svg`}
                            width={30}
                        /> </div>
                </CardHeader>
                <CardBody>
                    <Doughnut
                        options={{
                            responsive: true,
                            aspectRatio: 1.2,
                            plugins: {
                                legend: {
                                    position: 'bottom',
                                    labels: {
                                        boxWidth: 10
                                    }
                                }
                            }
                        }}
                        data={{
                            labels: ["Correct", "Incorrect", "Not Attempted"],
                            datasets: [
                                {
                                    data: [5, 17, 12],
                                    backgroundColor: [
                                        'rgba(65, 239, 106, 0.2)',
                                        'rgba(255, 99, 132, 0.2)',
                                        'rgba(220,220,220,0.2)'
                                    ],
                                    borderColor: [
                                        'rgba(65, 239, 106, 1)',
                                        'rgba(255, 99, 132, 1)',
                                        'rgba(220,220,220,1)'
                                    ],
                                    borderWidth: 1,
                                },
                            ],
                        }}
                    />
                </CardBody>
            </Card>
        </div>
    );
}