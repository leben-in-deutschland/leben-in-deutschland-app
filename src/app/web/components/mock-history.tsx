import { CrossIcon } from "@/icons/CrossIcon";
import { TickIcon } from "@/icons/TickIcon";
import { User } from "@/types/user";
import { Card, CardBody, CardHeader } from "@heroui/react";

export default function MockHistory({ user, handleHistoryPress, translation }: { user: User, handleHistoryPress: any, translation: any }) {
    return (
        <Card className="card-stats">
            <CardHeader className="justify-center">
                <h2 className="font-bold text-uppercase text-muted">
                    {translation.dashboard_mock_test_history}
                </h2>
            </CardHeader>
            <CardBody>
                <div className="overflow-y-auto scroll-auto h-44">
                    {user && user.testProgress?.length >= 0 && [...user.testProgress].reverse().map((x) => (
                        <>
                            <Card key={x.datetime + "1"}
                                className={`hidden md:flex mb-3 mt-3 w-[100%] ${x.cancelled ? "bg-gray-200" : (x.passed ? "bg-green-200" : "bg-red-200")}`}
                                shadow="none"
                                isDisabled={x.cancelled}
                                isPressable
                                onPress={() => { if (!x.cancelled) { handleHistoryPress(x.datetime); } }}>
                                <CardBody>
                                    <div className="justify-between flex">
                                        <div className="bg-gray-300 rounded-xl p-2">
                                            <p className="text-black font-bold">{new Date(x.datetime).toLocaleDateString()}</p>
                                            <p className="font-bold text-[5%] text-gray-500">{new Date(x.datetime).toLocaleTimeString()}</p>
                                        </div>
                                        <div className="bg-gray-300 rounded-xl p-2">
                                            <p className="text-black font-bold">{translation.time_taken}</p>
                                            <p className="text-black">{(Number(x.timeTake) / 60).toFixed(2)} <span className="font-bold text-[5%] text-gray-500">{translation.minutes}</span></p>
                                        </div>
                                        <div className="bg-green-400 rounded-xl p-2">
                                            <p className="text-black font-bold">{translation.correct}</p>
                                            <p className="font-extrabold">{x.questions.filter(x => x.answeredCorrectly).length}</p>
                                        </div>
                                        <div className="bg-red-400 rounded-xl p-2">
                                            <p className="text-black font-bold">{translation.incorrect}</p>
                                            <p className="font-extrabold">{x.questions.filter(x => !x.answeredCorrectly).length}</p>
                                        </div>
                                        <div className="bg-gray-400 rounded-xl p-2">
                                            <p className="text-black font-bold">{translation.result}</p>
                                            {x.passed ? <p className="text-center text-green-700"><TickIcon /> </p> : <p className="text-center text-red-700"><CrossIcon /> </p>}

                                        </div>
                                    </div>
                                </CardBody>
                            </Card>
                            <Card key={x.datetime + "2"}
                                className={`md:hidden mt-3 w-[100%] ${x.cancelled ? "bg-gray-200" : (x.passed ? "bg-green-200" : "bg-red-200")}`}
                                shadow="none"
                                isDisabled={x.cancelled}
                                isPressable
                                onPress={() => { if (!x.cancelled) { handleHistoryPress(x.datetime); } }}>
                                <CardBody>
                                    <div className="flex flex-col gap-2">
                                        <div className="bg-gray-300 rounded-xl p-1 flex justify-between">
                                            <div>
                                                <p className="text-black font-bold">{new Date(x.datetime).toLocaleDateString()}</p>
                                                <p className="font-bold text-[5%] text-gray-500">{new Date(x.datetime).toLocaleTimeString()}</p>
                                            </div>
                                            <div>
                                                <p className="text-black font-bold">{translation.time_taken}</p>
                                                <p className="text-black">{(Number(x.timeTake) / 60).toFixed(2)} <span className="font-bold text-[5%] text-gray-500">{translation.minutes}</span></p>
                                            </div>
                                        </div>
                                        <div className="flex gap-4 justify-between bg-gray-300 rounded-xl p-1" >
                                            <div className="bg-green-400 rounded-xl p-2">
                                                <p className="text-black font-bold">{translation.correct}</p>
                                                <p className="font-extrabold">{x.questions.filter(x => x.answeredCorrectly).length}</p>
                                            </div>
                                            <div className="bg-red-400 rounded-xl p-2">
                                                <p className="text-black font-bold">{translation.incorrect}</p>
                                                <p className="font-extrabold">{x.questions.filter(x => !x.answeredCorrectly).length}</p>
                                            </div>

                                            <div className="bg-gray-400 rounded-xl p-2">
                                                <p className="text-black font-bold">{translation.result}</p>
                                                {x.passed ? <p className="text-center text-green-700"><TickIcon /> </p> : <p className="text-center text-red-700"><CrossIcon /> </p>}

                                            </div>
                                        </div>
                                    </div>
                                </CardBody>
                            </Card>
                        </>
                    ))}
                </div>
            </CardBody>
        </Card >
    );

}