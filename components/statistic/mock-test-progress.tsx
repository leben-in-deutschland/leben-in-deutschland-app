import { User } from "@/types/user";
import { Card, CardBody, CardHeader } from "@nextui-org/react";
import { Doughnut } from "react-chartjs-2";

export const MockTestProgress = ({ user }: { user: User }) => {
    return (
        <div style={{ width: "18rem" }}>
            <Card className="card-stats border-none h-[300px]">

                <CardHeader className="justify-between">
                    <h2 className="font-bold text-uppercase text-muted">
                        Mock Tests
                    </h2>
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
                            labels: ["Passed", "Failed"],
                            datasets: [
                                {
                                    data: [5, 17],
                                    backgroundColor: [
                                        'rgba(65, 239, 106, 0.2)',
                                        'rgba(255, 99, 132, 0.2)',
                                    ],
                                    borderColor: [
                                        'rgba(65, 239, 106, 1)',
                                        'rgba(255, 99, 132, 1)',
                                    ],
                                    borderWidth: 1,
                                },
                            ],
                        }}
                    />
                </CardBody>
            </Card>
        </div >
    );
};