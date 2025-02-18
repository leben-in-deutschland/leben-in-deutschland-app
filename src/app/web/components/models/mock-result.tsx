import { CrossIcon } from "@/icons/CrossIcon";
import { TickIcon } from "@/icons/TickIcon";
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
            backdrop="transparent"
            isDismissable={true}
            hideCloseButton={false}
            onClose={handleClose}>
            <ModalContent>
                <ModalHeader className="flex flex-col gap-1 dark:text-white">{translation.result}</ModalHeader>
                <ModalBody>
                    <div className="flex flex-col gap-2">
                        <div className="flex bg-gray-300 rounded-xl p-2 justify-between">
                            <p className="text-black font-bold">{translation.date}</p>
                            <div>
                                <p className="text-black font-bold">{new Date(testProgress.datetime).toLocaleDateString()}</p>
                                <p className="font-bold text-[5%] text-gray-500">{new Date(testProgress.datetime).toLocaleTimeString()}</p>
                            </div>
                        </div>
                        <div className="flex bg-gray-300 rounded-xl p-2 justify-between">
                            <p className="text-black font-bold">{translation.time_taken}</p>
                            <p className="text-black">{(Number(testProgress.timeTake) / 60).toFixed(2)} <span className="font-bold text-[5%] text-gray-500">{translation.minutes}</span></p>
                        </div>
                        <div className="flex bg-green-400 rounded-xl p-2 justify-between">
                            <p className="text-black font-bold">{translation.correct}</p>
                            <p className="font-extrabold">{testProgress.questions.filter(x => x.answeredCorrectly).length}</p>
                        </div>
                        <div className="flex bg-red-400 rounded-xl p-2 justify-between">
                            <p className="text-black font-bold">{translation.incorrect}</p>
                            <p className="font-extrabold">{testProgress.questions.filter(x => !x.answeredCorrectly).length}</p>
                        </div>
                        <div className="flex bg-gray-400 rounded-xl p-2 justify-between">
                            <p className="text-black font-bold">{translation.result}</p>
                            {testProgress.passed ?
                                <p className="text-center text-green-700"><TickIcon />{translation.passed}</p>
                                : <p className="text-center text-red-700"><CrossIcon />{translation.failed}</p>}
                        </div>
                    </div>
                </ModalBody>
            </ModalContent >

        </Modal >
    );
};