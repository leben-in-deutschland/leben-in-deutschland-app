import { User } from "@/types/user";
import { Button, Card, CardBody, CardHeader } from "@nextui-org/react";
import { signIn } from "next-auth/react";

export default function MockHistory({ isAuthenticated, user }: { isAuthenticated: boolean, user: User }) {
    return (
        <Card className={`card-stats border-none h-[100%]`}>
            <CardHeader className={`justify-between ${isAuthenticated ? "blur-none" : "blur-sm"}`}>
                <h2 className="font-bold text-uppercase text-muted">
                    Mock Test History
                </h2>
            </CardHeader>
            <CardBody className={`${isAuthenticated ? "blur-none" : "blur-sm"}`}>

            </CardBody>
            {!isAuthenticated && <div className={`absolute inset-0 flex items-center justify-center z-10 `}>
                <Button
                    color="primary"
                    variant="solid"
                    onPress={() => signIn("google")}>
                    Sign In
                </Button>
            </div>}
        </Card >
    );

}