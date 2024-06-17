import { User } from '@/types/user';
import { Card, CardBody, CardHeader } from '@nextui-org/react';
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js';
import { Doughnut } from 'react-chartjs-2';

ChartJS.register(ArcElement, Tooltip, Legend);
export const TodayProgress = ({ user }: { user: User }) => {
    let today = new Date().toLocaleDateString();

    let todayProgressIndex = user.dailyProgress.findIndex(x => x.date === today);
    return (
        <div style={{ width: "18rem" }}>
            <Card className="card-stats border-none h-[300px]">

                <CardHeader className="justify-between">
                    <h2 className="font-bold text-uppercase text-muted">
                        Today
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
                            labels: ["Correct", "Incorrect"],
                            datasets: [
                                {
                                    data: [todayProgressIndex >= 0 ? user.dailyProgress[todayProgressIndex].correct : 0, todayProgressIndex >= 0 ? user.dailyProgress[todayProgressIndex].incorrect : 0],
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