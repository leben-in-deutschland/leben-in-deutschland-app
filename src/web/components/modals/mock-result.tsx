import { CrossIcon } from "@/icons/CrossIcon";
import { TickIcon } from "@/icons/TickIcon";
import { TrophyIcon } from "@/icons/TrophyIcon";
import { ClockIcon } from "@/icons/ClockIcon";
import { CalendarIcon } from "@/icons/CalendarIcon";
import { CheckCircleIcon } from "@/icons/CheckCircleIcon";
import { XCircleIcon } from "@/icons/XCircleIcon";
import { MockTestProgress } from "@/types/user";
import { Modal, ModalBody, ModalContent, ModalHeader } from "@heroui/react";

export const MockResult = ({
    testProgress, handleClose, isModelOpen, translation }:
    {
        testProgress: MockTestProgress
        isModelOpen: boolean
        handleClose: any,
        translation: any
    }) => {
    return (
        <Modal
            isOpen={isModelOpen}
            backdrop="blur"
            isDismissable={true}
            hideCloseButton={false}
            onClose={handleClose}>
            <ModalContent>
                <ModalHeader className="flex items-center gap-2 text-foreground">
                    <div className={`${testProgress.passed ? "bg-success/10 text-success" : "bg-danger/10 text-danger"} rounded-lg p-1.5`}>
                        <TrophyIcon size={18} />
                    </div>
                    {translation.result}
                </ModalHeader>
                <ModalBody className="pb-6">
                    <div className="flex flex-col gap-2.5">
                        <div className="flex bg-default-100 dark:bg-default-50 rounded-xl p-3 justify-between items-center">
                            <div className="flex items-center gap-2">
                                <CalendarIcon size={14} className="text-foreground/50" />
                                <p className="text-foreground font-semibold text-sm">{translation.date}</p>
                            </div>
                            <div className="text-right">
                                <p className="text-foreground font-bold text-sm">{new Date(testProgress.datetime).toLocaleDateString()}</p>
                                <p className="text-foreground/50 text-xs">{new Date(testProgress.datetime).toLocaleTimeString()}</p>
                            </div>
                        </div>
                        <div className="flex bg-default-100 dark:bg-default-50 rounded-xl p-3 justify-between items-center">
                            <div className="flex items-center gap-2">
                                <ClockIcon size={14} className="text-foreground/50" />
                                <p className="text-foreground font-semibold text-sm">{translation.time_taken}</p>
                            </div>
                            <p className="text-foreground font-bold text-sm">{(Number(testProgress.timeTake) / 60).toFixed(2)} <span className="text-foreground/50 text-xs font-normal">{translation.minutes}</span></p>
                        </div>
                        <div className="flex bg-success/10 dark:bg-success/10 rounded-xl p-3 justify-between items-center">
                            <div className="flex items-center gap-2">
                                <CheckCircleIcon size={14} className="text-success" />
                                <p className="text-foreground font-semibold text-sm">{translation.correct}</p>
                            </div>
                            <p className="font-extrabold text-success">{testProgress.questions.filter(x => x.answeredCorrectly).length}</p>
                        </div>
                        <div className="flex bg-danger/10 dark:bg-danger/10 rounded-xl p-3 justify-between items-center">
                            <div className="flex items-center gap-2">
                                <XCircleIcon size={14} className="text-danger" />
                                <p className="text-foreground font-semibold text-sm">{translation.incorrect}</p>
                            </div>
                            <p className="font-extrabold text-danger">{testProgress.questions.filter(x => !x.answeredCorrectly).length}</p>
                        </div>
                        <div className={`flex ${testProgress.passed ? "bg-success/10" : "bg-danger/10"} rounded-xl p-3 justify-between items-center`}>
                            <p className="text-foreground font-semibold text-sm">{translation.result}</p>
                            {testProgress.passed ?
                                <div className="flex items-center gap-1.5 text-success font-bold">
                                    <TickIcon size={20} />
                                    <span>{translation.passed}</span>
                                </div>
                                : <div className="flex items-center gap-1.5 text-danger font-bold">
                                    <CrossIcon size={20} />
                                    <span>{translation.failed}</span>
                                </div>}
                        </div>
                    </div>
                </ModalBody>
            </ModalContent >

        </Modal >
    );
};
