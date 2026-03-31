"use client";

import { ProgressLine } from "./progress-line";
import { TodayProgress } from "./today-progress";
import { CorrectIncorrectLine } from "./correct-incorrect-line";
import { MockTestProgress } from "./mock-test-progress";
import { NumberProgress } from "./number-progress";
import { StateProgress } from "./state-progress";
import { User } from "@/types/user";
import { Question } from "@/types/question";
import { useRouter } from "next/navigation";
import { navigateTo } from "@/utils/navigation";
import { CategoryStats } from "./category-progress";
import { SkipIcon } from "@/icons/SkipIcon";
import { FlagOutlineIcon } from "@/icons/FlagOutlineIcon";
import { CheckCircleIcon } from "@/icons/CheckCircleIcon";
import { XCircleIcon } from "@/icons/XCircleIcon";
import { HashIcon } from "@/icons/HashIcon";
import { ClipboardCheckIcon } from "@/icons/ClipboardCheckIcon";
import { TrophyIcon } from "@/icons/TrophyIcon";
import { CrossIcon } from "@/icons/CrossIcon";

export const UserStats = ({ showMore, user, questions, translation }: { showMore: boolean, user: User, questions: Question[], translation: any }) => {
    const router = useRouter();
    const isNumeric = (val: string): boolean => !isNaN(Number(val));
    const relevantProgress = user.questionProgress.filter(x => x?.num.startsWith(user.state.stateCode) || isNumeric(x?.num));

    let flagged = relevantProgress.filter(x => x.flagged).length;
    let correct = relevantProgress.filter(x => x.answeredCorrectly !== null && x.answeredCorrectly).length;
    let incorrect = relevantProgress.filter(x => x.answeredCorrectly !== null && !x.answeredCorrectly).length;
    let attempted = relevantProgress.length;
    let mockAttempted = user.testProgress.length;
    let mockPassed = user.testProgress.filter(x => x.passed).length;
    let mockFailed = user.testProgress.filter(x => !x.passed).filter(x => !x.cancelled).length;

    const getSkipped = () => {
        let skipped = relevantProgress.filter(x => x.skipped);
        let otherSkipped = relevantProgress.filter(x => x.answeredCorrectly === null && !x.flagged);
        for (let i = 0; i < otherSkipped.length; i++) {
            if (!skipped.find(x => x.num === otherSkipped[i].num)) {
                skipped.push(otherSkipped[i]);
            }
        }
        return skipped.length;
    };
    let skipped = getSkipped();
    return (
        <div className="grid gap-y-5">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
                <NumberProgress title={translation.skipped} count={skipped} numberColor={""} isPressable={skipped > 0} onPress={() => navigateTo("/prepare?action=skipped", router.push)} icon={<SkipIcon size={14} />} />
                <NumberProgress title={translation.flagged} count={flagged} numberColor={""} isPressable={flagged > 0} onPress={() => navigateTo("/prepare?action=flagged", router.push)} icon={<FlagOutlineIcon size={14} />} />
                <NumberProgress title={translation.correct} count={correct} numberColor={"green-500"} isPressable={correct > 0} onPress={() => navigateTo("/prepare?action=correct", router.push)} icon={<CheckCircleIcon size={14} />} />
                <NumberProgress title={translation.incorrect} count={incorrect} numberColor={"red-700"} isPressable={incorrect > 0} onPress={() => navigateTo("/prepare?action=incorrect", router.push)} icon={<XCircleIcon size={14} />} />

                <NumberProgress title={translation.attempted} count={attempted} numberColor={""} isPressable={false} onPress={null} icon={<HashIcon size={14} />} />
                <NumberProgress title={translation.test_attempted} count={mockAttempted} numberColor={""} isPressable={false} onPress={null} icon={<ClipboardCheckIcon size={14} />} />
                <NumberProgress title={translation.test_passed} count={mockPassed} numberColor={"green-500"} isPressable={false} onPress={null} icon={<TrophyIcon size={14} />} />
                <NumberProgress title={translation.test_failed} count={mockFailed} numberColor={"red-700"} isPressable={false} onPress={null} icon={<CrossIcon size={14} />} />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
                <TodayProgress translation={translation} user={user} />
                <ProgressLine translation={translation} user={user} />
                <MockTestProgress translation={translation} user={user} />
                <StateProgress translation={translation} user={user} questions={questions} onPress={() => navigateTo("/prepare?action=state", router.push)} />
            </div>
            {showMore &&
                <div hidden={!showMore}>
                    <CategoryStats translation={translation} questions={questions} user={user} />
                    <CorrectIncorrectLine translation={translation} user={user} />
                </div>
            }
        </div>

    );
};
