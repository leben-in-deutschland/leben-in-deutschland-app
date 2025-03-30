import { statesData, pruefstellenData } from "@/data/data";
import { MailIcon } from "@/icons/MailIcon";
import { MapIcon } from "@/icons/MapIcon";
import { PhoneIcon } from "@/icons/PhoneIcon";
import { Prüfstellen } from "@/types/prüfstellen";
import { Card, CardBody, CardHeader, Image, Link } from "@heroui/react";
import { Metadata, ResolvingMetadata } from "next";

export async function generateStaticParams() {
    const stateData = statesData();
    return [
        ...stateData.map((state) => ({ state: state.code.toUpperCase() })),
        ...stateData.map((state) => ({ state: state.code.toLocaleLowerCase() })),
    ];
}
export async function generateMetadata(
    {
        params,
    }: {
        params: Promise<{ state: string }>
    },
    parent: ResolvingMetadata
): Promise<Metadata> {
    const { state } = await params
    const stateData = statesData();
    const stateRelatedData = stateData.find(x => x.code.toUpperCase() === state.toUpperCase());
    return {
        title: `Prüfstellen in ${state.toUpperCase()} - ${stateRelatedData?.name}`,
        description: `Einbürgerungstest oder Leben in Deutschland ${stateRelatedData ? `Prüfstellen in ${stateRelatedData.name}` : `Prüfstellen in ${state.toUpperCase()}`} `,
    }
}

export default async function Pruefstellen({
    params,
}: {
    params: Promise<{ state: string }>
}) {
    const { state } = await params
    const stateData = statesData();

    const stateRelatedData = stateData.find(x => x.code.toUpperCase() === state.toUpperCase());
    const stellen = pruefstellenData();
    let statePlaces: Prüfstellen[] = [];
    if (state) {
        statePlaces = stellen.filter(x => x.stateCode.toUpperCase() === state.toUpperCase()).flatMap(x => x.data);
    }

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
        </Card >
    );
}