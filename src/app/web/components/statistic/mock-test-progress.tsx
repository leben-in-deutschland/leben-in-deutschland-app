import { User } from "@/types/user";
import { Card, CardBody, CardHeader } from "@heroui/react";
import { Doughnut } from "react-chartjs-2";

export const MockTestProgress = ({ user }: { user: User }) => {
    let cancelledMock = user.testProgress.filter(x => x.cancelled).length;
    let passedMock = user.testProgress.filter(x => x.passed).length;
    let failedMock = user.testProgress.filter(x => !x.passed).length;
    return (
        <div>
            <Card className="card-stats border-none h-[300px]">

                <CardHeader className="justify-center">
                    <h2 className="font-bold text-uppercase text-muted">
                        Mock Tests
                    </h2>
                </CardHeader>
                <CardBody className="items-center">
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
                            labels: ["Passed", "Failed", "Cancelled"],
                            datasets: [
                                {
                                    data: [passedMock, failedMock, cancelledMock],
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
        </div >
    );
};