import { CrossIcon } from "@/icons/CrossIcon";
import { TickIcon } from "@/icons/TickIcon";
import { User } from "@/types/user";
import { Card, CardBody, CardHeader } from "@heroui/react";

export default function MockHistory({ isAuthenticated, user, handleHistoryPress }: { isAuthenticated: boolean, user: User, handleHistoryPress: any }) {
    return (
        <Card className="card-stats">
            <CardHeader className="justify-center">
                <h2 className="font-bold text-uppercase text-muted">
                    Mock Test History
                </h2>
            </CardHeader>
            <CardBody>
                <div className="overflow-y-auto scroll-auto h-44">
                    {user && user.testProgress?.length >= 0 && [...user.testProgress].reverse().map((x) => (
                        <Card key={x.datetime}
                            className={`mb-3 mt-3 w-[100%] ${x.cancelled ? "bg-gray-200" : (x.passed ? "bg-green-200" : "bg-red-200")}`}
                            shadow="none"
                            isDisabled={x.cancelled}
                            isPressable
                            onPress={() => { if (!x.cancelled) { handleHistoryPress(x.datetime); } }}>
                            <CardBody>
                                <div className="flex justify-between">
                                    <div className="bg-gray-300 rounded-xl p-2">
                                        <p className="text-black font-bold">{new Date(x.datetime).toLocaleDateString()}</p>
                                        <p className="font-bold text-[5%] text-gray-500">{new Date(x.datetime).toLocaleTimeString()}</p>
                                    </div>
                                    <div className="bg-gray-300 rounded-xl p-2">
                                        <p className="text-black font-bold">Time Taken</p>
                                        <p className="text-black">{(Number(x.timeTake) / 60).toFixed(2)} <span className="font-bold text-[5%] text-gray-500">minutes</span></p>
                                    </div>
                                    <div className="bg-green-400 rounded-xl p-2">
                                        <p className="text-black font-bold">Correct</p>
                                        <p className="font-extrabold">{x.questions.filter(x => x.answeredCorrectly).length}</p>
                                    </div>
                                    <div className="bg-red-400 rounded-xl p-2">
                                        <p className="text-black font-bold">Incorrect</p>
                                        <p className="font-extrabold">{x.questions.filter(x => !x.answeredCorrectly).length}</p>
                                    </div>
                                    <div className="bg-gray-400 rounded-xl p-2">
                                        <p className="text-black font-bold">Result</p>
                                        {x.passed ? <p className="text-center text-green-700"><TickIcon /> </p> : <p className="text-center text-red-700"><CrossIcon /> </p>}

                                    </div>
                                </div>
                            </CardBody>
                        </Card>
                    ))}
                </div>
            </CardBody>
            {/* 
            ${isAuthenticated ? "blur-none" : "blur-sm"}
            {!isAuthenticated && <div className={`absolute inset-0 flex items-center justify-center z-10 `}>
                <Button
                    color="primary"
                    variant="solid"
                    onPress={() => signIn("auth0")}>
                    Sign In
                </Button>
            </div>} */}
        </Card >
    );

}