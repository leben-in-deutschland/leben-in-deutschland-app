"use client";

import { MailIcon } from "@/icons/MailIcon";
import { MapIcon } from "@/icons/MapIcon";
import { PhoneIcon } from "@/icons/PhoneIcon";
import { Prüfstellen } from "@/types/prüfstellen";
import { State } from "@/types/state";
import { Card, CardBody, CardHeader, Image, Link } from "@heroui/react";

export const PruefstellenContent = ({
    stateRelatedData,
    statePlaces,
    state,
}: {
    stateRelatedData: State | undefined;
    statePlaces: Prüfstellen[];
    state: string;
}) => {
    return (
        <Card className="p-2">
            <CardHeader className="flex justify-between">
                <p className="text-xl text-black dark:text-white">Prüfstellen in <span className="font-bold">{stateRelatedData?.name}</span></p>
                <Image alt={stateRelatedData?.code} src={`/states/coat-of-arms/${stateRelatedData?.name}.svg`} width={50} />
            </CardHeader>
            <CardBody>
                <div className="flex flex-col gap-2 md:grid md:grid-cols-2 md:gap-4">
                    {
                        state && statePlaces && statePlaces.length > 0 && statePlaces.map((place: Prüfstellen) =>
                            <Card key={place.straße + place.plz} className="p-2">
                                <CardBody>
                                    <p className="font-bold">{place.regierungsbezirk}</p>
                                    <p className="font-bold">{place.einrichtung}</p>
                                    <span className="flex gap-1"><MapIcon className="dark:invert" /><p>{place.straße}</p></span>
                                    <span className="flex gap-1"><MapIcon className="dark:invert" /> <p>{place.plz} {place.ort}</p></span>
                                    <span className="flex gap-1"><PhoneIcon className="dark:invert" /><p>{place.telefon}</p></span>
                                    <span className="flex gap-1"><MailIcon className="dark:invert" /><Link href={`mailto:${place.email}`} target="_blank" className="hover:underline">{place.email}</Link></span>
                                </CardBody>
                            </Card>
                        )
                    }
                </div>
            </CardBody>
        </Card>
    );
};
