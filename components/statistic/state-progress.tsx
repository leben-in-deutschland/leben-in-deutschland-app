import { Card, CardBody, CardHeader, Image } from "@nextui-org/react"
import { Doughnut } from "react-chartjs-2";
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js';
import { Question } from "@/types/question";
import { UserState } from "@/types/user";
ChartJS.register(ArcElement, Tooltip, Legend);
export const StateProgress = ({ state, questions, onPress }: { state: UserState, questions: Question[], onPress: any }) => {
    let totalQuestion = questions.filter(element => element.num.startsWith(state.stateCode)).length;

    return (
        <div style={{ width: "18rem" }}>
            <Card className="card-stats border-none h-[300px]"
                isPressable
                onPress={onPress}>
                <CardHeader className="justify-between">
                    <h2 className="font-bold text-uppercase text-muted">
                        {state.stateName}
                    </h2>
                    <div className="text-gray-400">
                        <Image
                            alt={state.stateName}
                            className="object-cover justify-center items-center"
                            src={`/states/coat-of-arms/${state.stateName}.svg`}
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
                                    data: [state.correct, state.incorrect, (totalQuestion - (state.correct + state.incorrect))],
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