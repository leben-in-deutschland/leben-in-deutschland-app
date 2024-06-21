import { User } from '@/types/user';
import { Card, CardBody, CardHeader } from '@nextui-org/react';
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js';
import { Doughnut } from 'react-chartjs-2';

ChartJS.register(ArcElement, Tooltip, Legend);
export const TodayProgress = ({ user }: { user: User }) => {
    let today = new Date().toUTCString();
    let correct = 0;
    let incorrect = 0;
    let skipped = 0;
    let flagged = 0;
    let todayProgressIndex = user.dailyProgress.findIndex(x => x.date === today);
    if (todayProgressIndex > -1) {
        let temp = user.dailyProgress[todayProgressIndex];

        correct = temp.correct;
        incorrect = temp.incorrect;
        skipped = temp.skipped;
        flagged = temp.flagged;
    }

    return (
        <div>
            <Card className="card-stats border-none h-[300px]">

                <CardHeader className="justify-center">
                    <h2 className="font-bold text-uppercase text-muted">
                        Today
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
                            labels: ["Correct", "Incorrect", "Skipped", "Flagged"],
                            datasets: [
                                {
                                    data: [correct, incorrect, skipped, flagged],
                                    backgroundColor: [
                                        'rgba(65, 239, 106, 0.2)',
                                        'rgba(255, 99, 132, 0.2)',
                                        'rgba(227, 131, 255, 0.2)',
                                        'rgba(246, 246, 115, 0.2)',
                                    ],
                                    borderColor: [
                                        'rgba(65, 239, 106, 1)',
                                        'rgba(255, 99, 132, 1)',
                                        'rgba(227, 131, 255, 1)',
                                        'rgba(246, 246, 115, 1)',
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