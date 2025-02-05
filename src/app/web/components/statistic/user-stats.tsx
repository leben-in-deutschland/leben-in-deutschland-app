"use client";

import { ProgressLine } from "./progress-line";
import { TodayProgress } from "./today-progress";
import { CorrectIncorrectBar } from "./correct-incorrect-bar";
import { MockTestProgress } from "./mock-test-progress";
import { NumberProgress } from "./number-progress";
import { StateProgress } from "./state-progress";
import { User } from "@/types/user";
import { Question } from "@/types/question";
import { useRouter } from "next/navigation";

export const UserStats = ({ showMore, user, questions }: { showMore: boolean, user: User, questions: Question[] }) => {
    const router = useRouter();
    let skipped = user.questionProgress.filter(x => x.skipped).length;
    let otherSkipped = user.questionProgress.filter(x => x.answeredCorrectly === null && !x.flagged).length;
    skipped += otherSkipped;
    let flagged = user.questionProgress.filter(x => x.flagged).length;
    let correct = user.questionProgress.filter(x => x.answeredCorrectly !== null && x.answeredCorrectly).length;
    let incorrect = user.questionProgress.filter(x => x.answeredCorrectly !== null && !x.answeredCorrectly).length;
    let attempted = user.questionProgress.length;
    let mockAttempted = user.testProgress.length;
    let mockPassed = user.testProgress.filter(x => x.passed).length;
    let mockFailed = user.testProgress.filter(x => !x.passed).length;
    return (
        <div className="grid gap-y-5">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
                <NumberProgress title="Skipped" count={skipped} numberColor={""} isPressable={skipped > 0} onPress={() => router.push("/prepare?action=skipped")} />
                <NumberProgress title="Flagged" count={flagged} numberColor={""} isPressable={flagged > 0} onPress={() => router.push("/prepare?action=flagged")} />
                <NumberProgress title="Correct" count={correct} numberColor={"green-500"} isPressable={correct > 0} onPress={() => router.push("/prepare?action=correct")} />
                <NumberProgress title="Incorrect" count={incorrect} numberColor={"red-700"} isPressable={incorrect > 0} onPress={() => router.push("/prepare?action=incorrect")} />

                <NumberProgress title="Attempted" count={attempted} numberColor={""} isPressable={false} onPress={null} />
                <NumberProgress title="Test Attempted" count={mockAttempted} numberColor={""} isPressable={false} onPress={null} />
                <NumberProgress title="Test Passed" count={mockPassed} numberColor={"green-500"} isPressable={false} onPress={null} />
                <NumberProgress title="Test Failed" count={mockFailed} numberColor={"red-700"} isPressable={false} onPress={null} />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
                <TodayProgress user={user} />
                <ProgressLine user={user} />
                <MockTestProgress user={user} />
                <StateProgress user={user} questions={questions} onPress={() => router.push("/prepare?action=state")} />
            </div>
            <div hidden={!showMore}>
                <CorrectIncorrectBar user={user} />
            </div>
        </div>

    );
};