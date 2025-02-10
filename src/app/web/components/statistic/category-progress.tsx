import { User, UserQuestionProgress } from "@/types/user";
import { categories, Question } from "@/types/question";
import { Card, CardBody, CardHeader, Chip } from "@heroui/react";
import { Doughnut } from "react-chartjs-2";
type CategoryData = {
    "key": string,
    "totalQuestion": number,
    "correct": number,
    "incorrect": number,
    "skipped": number,
    "flagged": number
}
export const CategoryStats = ({ user, questions }: { user: User, questions: Question[] }) => {
    let data: CategoryData[] = [];
    for (let category of categories) {
        let categoryData: CategoryData = {
            key: category,
            totalQuestion: 0,
            correct: 0,
            incorrect: 0,
            skipped: 0,
            flagged: 0
        };
        const totalQuestion = questions.filter((question) => question.category === category);
        categoryData.totalQuestion = totalQuestion.length;
        const totalAttemptedQuestions: UserQuestionProgress[] = [];

        for (let question of totalQuestion) {
            let questionData = user.questionProgress.find(x => x.num === question.num);
            if (questionData) {
                totalAttemptedQuestions.push(questionData);
            }
        }

        let skipped = totalAttemptedQuestions.filter(x => x.skipped).length;
        let otherSkipped = totalAttemptedQuestions.filter(x => x.answeredCorrectly === null && !x.flagged).length;
        categoryData.skipped = skipped + otherSkipped;
        categoryData.flagged = totalAttemptedQuestions.filter(x => x.flagged).length;

        categoryData.correct = totalAttemptedQuestions.filter((question) => question.answeredCorrectly !== null && question.answeredCorrectly).length
        categoryData.incorrect = totalAttemptedQuestions.filter((question) => question.answeredCorrectly !== null && !question.answeredCorrectly).length
        data.push(categoryData);
    }
    return (
        <Card className="mt-4 mb-4">
            <CardHeader>
                <h2 className="font-bold text-uppercase text-muted">Category Progress</h2>
            </CardHeader>
            <CardBody>
                <div className="flex flex-col md:flex-row md:flex-wrap gap-2 md:justify-between">
                    {data.map((categoryData, index) =>
                        <Card key={index} className="card-stats border-none h-[300px]">
                            <CardHeader className="flex justify-between">
                                <span>{categoryData.key}</span>
                                <Chip>{categoryData.totalQuestion}</Chip>
                            </CardHeader>
                            <CardBody className="items-center">
                                <Doughnut
                                    key={index}
                                    title={categoryData.key}
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
                                        labels: ["Total", "Correct", "Incorrect", "Skipped", "Flagged"],
                                        datasets: [
                                            {
                                                data: [categoryData.totalQuestion, categoryData.correct, categoryData.incorrect, categoryData.skipped, categoryData.flagged],
                                                backgroundColor: [
                                                    'rgba(220,220,220,0.2)',
                                                    'rgba(65, 239, 106, 0.2)',
                                                    'rgba(255, 99, 132, 0.2)',
                                                    'rgba(220,220,220,0.2)',
                                                    'rgba(246, 246, 115, 0.2)',
                                                ],
                                                borderColor: [
                                                    'rgba(220,220,220,1)',
                                                    'rgba(65, 239, 106, 1)',
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
                        </Card>
                    )}
                </div>
            </CardBody>
        </Card>
    );
};