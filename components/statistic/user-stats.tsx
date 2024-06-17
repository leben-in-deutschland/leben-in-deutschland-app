"use client";

import { ProgressLine } from "./progress-line";
import { TodayProgress } from "./today-progress";
import { CorrectIncorrectBar } from "./correct-incorrect-bar";
import { MockTestProgress } from "./mock-test-progress";
import { NumberProgress } from "./number-progress";
import { StateProgress } from "./state-progress";
import { User } from "@/types/user";
import { PrepareQuestionActions, PrepareQuestionType } from "@/types/prepare-question";

export const UserStats = ({ showMore, user, handleStalePress }: { showMore: boolean, user: User, handleStalePress: any }) => {
    return (
        <div className="grid gap-y-5">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
                <NumberProgress title="Skipped" count={user.overallProgress.skipped} numberColor={""} isPressable={true} onPress={() => handleStalePress(PrepareQuestionActions.Skipped)} />
                <NumberProgress title="Attempted" count={user.overallProgress.attempted} numberColor={""} isPressable={false} onPress={null} />
                <NumberProgress title="Flagged" count={user.overallProgress.flagged} numberColor={""} isPressable={true} onPress={() => handleStalePress(PrepareQuestionActions.Flagged)} />
                <NumberProgress title="Mock Test Failed" count={user.overallProgress.mockFailed} numberColor={"red-700"} isPressable={true} onPress={() => handleStalePress(PrepareQuestionActions.Failed)} />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
                <TodayProgress user={user} />
                <ProgressLine user={user} />
                <MockTestProgress user={user} />
                <StateProgress stateName={user.state} />
            </div>
            <div hidden={!showMore}>
                <CorrectIncorrectBar user={user} />
            </div>
        </div>

    );
};