import { Link, Card, CardBody, CardFooter, CardHeader, Image } from "@heroui/react"
import { Doughnut } from "react-chartjs-2";
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js';
import { Question } from "@/types/question";
import { User } from "@/types/user";
ChartJS.register(ArcElement, Tooltip, Legend);
export const StateProgress = ({ user, questions, onPress }: { user: User, questions: Question[], onPress: any }) => {
    let totalAttemptedStateQuestion = user.questionProgress.filter(element => element.num.startsWith(user.state.stateCode));

    let skipped = totalAttemptedStateQuestion.filter(x => x.skipped).length;
    let otherSkipped = totalAttemptedStateQuestion.filter(x => x.answeredCorrectly === null && !x.flagged).length;
    skipped += otherSkipped;
    let flagged = totalAttemptedStateQuestion.filter(x => x.flagged).length;
    let correct = totalAttemptedStateQuestion.filter(x => x.answeredCorrectly !== null && x.answeredCorrectly).length;
    let incorrect = totalAttemptedStateQuestion.filter(x => x.answeredCorrectly !== null && !x.answeredCorrectly).length;

    return (
        <div>
            <Card className="card-stats border-none h-[300px] w-[100%]"
                isPressable
                onPress={onPress}>
                <CardHeader className="justify-between">
                    <h2 className="font-bold text-uppercase text-muted">
                        {user.state.stateName}
                    </h2>
                    <div className="text-gray-400">
                        <Image
                            alt={user.state.stateName}
                            className="object-cover justify-center items-center"
                            src={`/states/coat-of-arms/${user.state.stateName}.svg`}
                            width={30}
                        /> </div>
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
                                        'rgba(220,220,220,0.2)',
                                        'rgba(246, 246, 115, 0.2)',
                                    ],
                                    borderColor: [
                                        'rgba(65, 239, 106, 1)',
                                        'rgba(255, 99, 132, 1)',
                                        'rgba(220,220,220,1)',
                                        'rgba(246, 246, 115, 1)',
                                    ],
                                    borderWidth: 1,
                                },
                            ],
                        }}
                    />
                </CardBody>
                <CardFooter className="justify-end">
                    <Link color="primary" className="mr-4 hover:underline md:mr-6" href={`/pruefstellen/${user.state.stateCode.toUpperCase()}`}>Prüfstellen</Link>
                </CardFooter>
            </Card>
        </div>
    );
}