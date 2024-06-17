import { User } from "@/types/user";
import { Card, CardBody, CardHeader } from "@nextui-org/react";

export default function PrepareQuestion({ isAuthenticated, user }: { isAuthenticated: boolean, user: User }) {
    return (
        <Card className={`card-stats border-none`}>
            <CardHeader className="justify-between">
                <h2 className="font-bold text-uppercase text-muted">
                    Prepare
                </h2>
            </CardHeader>
            <CardBody>

            </CardBody>
        </Card>
    );

}