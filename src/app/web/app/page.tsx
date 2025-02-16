"use client";

import ScreenshotSlider from "@/components/screenshot-slider";
import { getTranslations, statesData } from "@/data/data";
import { ArrowRightIcon } from "@/icons/ArrowRightIcon";
import { getUserData } from "@/services/user";
import { State } from "@/types/state";
import { User } from "@/types/user";
import { Capacitor } from "@capacitor/core";
import { Alert, Card, CardBody, CardFooter, CardHeader, Image, Spinner } from "@heroui/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export default function Home() {
  const [user, setUser] = useState<User>();
  const [states, setState] = useState<State[]>(statesData());
  const router = useRouter()
  const [showLoading, setShowLoading] = useState(Capacitor.isNativePlatform());
  const allTranslations = getTranslations(user?.appLanguage ?? "de");
  useEffect(() => {
    if (Capacitor.isNativePlatform()) {
      setShowLoading(false);
      router.push("/dashboard");
    }
    setShowLoading(false);
  }, []);

  useEffect(() => {
    const stateData = statesData();
    setState(stateData);
    const handleUserChange = () => {
      let tempUser = getUserData();
      if (tempUser !== null) {
        setUser(tempUser);
      }
    }

    window.addEventListener('user', handleUserChange)
    return () => window.removeEventListener('user', handleUserChange)
  }, []);
  return (
    <div className="flex flex-col gap-2 content-center">

      {showLoading ? <Spinner content="Loading..." /> :
        <>
          <Alert color="warning" title={allTranslations.alert1} />
          <Alert color="danger" title={allTranslations.alert2} />

          <Card>
            <CardHeader>
              <p className="font-bold text-2xl text-black dark:text-white">{allTranslations.main_title}</p>
            </CardHeader>
            <CardBody>
              <p className="text-default-500">{allTranslations.main_subtitle1}</p>
              <p className="text-default-500 mt-2">{allTranslations.main_subtitle2}</p>
              <p className="text-default-500 mt-2">{allTranslations.main_subtitle3}</p>
              <p className="text-default-500 mt-2">{allTranslations.main_subtitle4}</p>
            </CardBody>
          </Card>

          <ScreenshotSlider title={allTranslations.screenshotTitle} />
          <Card>
            <CardHeader>
              <p className="font-bold text-2xl text-black dark:text-white">{allTranslations.faq_title}</p>
            </CardHeader>
            <CardBody>
              <div className="flex flex-col gap-2">
                <Card className="p-2">
                  <p className="font-bold text-default-500">{allTranslations.faq_q1}</p>
                  <p className="text-default-500">{allTranslations.faq_a1}</p>
                </Card>
                <Card className="p-2">
                  <p className="font-bold text-default-500">{allTranslations.faq_q2}</p>
                  <p className="text-default-500">{allTranslations.faq_a2}</p>
                </Card>
                <Card className="p-2">
                  <p className="font-bold text-default-500">{allTranslations.faq_q3}</p>
                  <p className="text-default-500">{allTranslations.faq_a3}</p>
                </Card>
              </div>
            </CardBody>
          </Card>


          <Card>
            <CardHeader>
              <p className="font-bold text-2xl text-black dark:text-white">{allTranslations.center_title}</p>
            </CardHeader>
            <CardBody>
              <p className="text-default-500">{allTranslations.center_subtitle}</p>
              <div className="grid grid-cols-8 gap-2">
                {states && states.map((state: State) =>
                  <Card key={state.code} isPressable onPress={() => router.push(`/pruefstellen/${state.code.toUpperCase()}`)}>
                    <CardBody className="overflow-visible p-0">
                      <Image
                        alt={state.name}
                        className="w-full object-cover h-[140px]"
                        radius="lg"
                        shadow="sm"
                        src={`/states/flag/${state.name}.svg`}
                        width="100%"
                      />
                    </CardBody>
                    <CardFooter className="text-small justify-between">
                      <b>{state.name}</b>
                      <p className="text-default-500">{state.code}</p>
                    </CardFooter>
                  </Card>
                )}
              </div>
            </CardBody>
          </Card>



          <Card className="p-2" isPressable onPress={() => router.push("/dashboard")}>
            <CardHeader>
              <p className="font-bold text-2xl text-black dark:text-white">{allTranslations.main_dashboard_title}</p>
            </CardHeader>
            <CardBody className="overflow-visible py-2 flex flex-col md:flex-row gap-4">
              <Image
                alt="stats"
                className="h-48 w-96 object-contain"
                radius="lg"
                shadow="sm"
                src={`/dashboard/stats.png`}
              />
              <div>
                <p className="text-default-500">{allTranslations.main_dashboard_subtitle1}</p>
                <p className="text-default-500 mt-2">{allTranslations.main_dashboard_subtitle2}</p>
                <p className="text-default-500 mt-2">{allTranslations.main_dashboard_subtitle3}</p>
                <span className="flex justify-end"><p className="font-bold text-default-500">{allTranslations.main_dashboard_href_text}</p><ArrowRightIcon /></span>
              </div>
            </CardBody>
          </Card>

          <Card className="p-2" isPressable onPress={() => router.push("/mock")}>
            <CardHeader>
              <p className="font-bold text-2xl text-black dark:text-white">{allTranslations.main_mock_title}</p>
            </CardHeader>
            <CardBody className="overflow-visible py-2 flex flex-col md:flex-row gap-4">
              <Image
                alt="mock exam"
                className="h-48 w-96 object-contain"
                radius="lg"
                shadow="sm"
                src={`/dashboard/mock.png`}
              />
              <div>
                <p className="text-default-500">{allTranslations.main_mock_subtitle1}</p>
                <p className="text-default-500 mt-2">{allTranslations.main_mock_subtitle2}</p>
                <span className="flex justify-end"><p className="font-bold text-default-500">{allTranslations.main_mock_href_text}</p><ArrowRightIcon /></span>
              </div>
            </CardBody>
          </Card>

          <Card className="p-2" isPressable onPress={() => router.push("/prepare")}>
            <CardHeader>
              <p className="font-bold text-2xl text-black dark:text-white">{allTranslations.main_prepare_title}</p>
            </CardHeader>
            <CardBody className="overflow-visible py-2 flex flex-col md:flex-row gap-4">
              <Image
                alt="prepare"
                className="h-48 w-96 object-contain"
                radius="lg"
                shadow="sm"
                src={`/dashboard/prepare.png`}
              />
              <div>
                <p className="text-default-500">{allTranslations.main_prepare_subtitle1}</p>
                <p className="text-default-500 mt-2">{allTranslations.main_prepare_subtitle2} </p>
                <p className="text-default-500">{allTranslations.main_prepare_subtitle3}</p>
                <p className="text-default-500 mt-2">{allTranslations.main_prepare_subtitle4} </p>
                <span className="flex justify-end"><p className="font-bold text-default-500">{allTranslations.main_prepare_href_text}</p><ArrowRightIcon /></span>
              </div>
            </CardBody>
          </Card>
          <Card>
            <CardHeader>
              <p className="font-bold text-2xl text-black dark:text-white">{allTranslations.main_question_catalogue_title}</p>
            </CardHeader>
            <CardBody>
              <div className="gap-2 grid md:grid-cols-4">
                <Card isPressable onPress={() => router.push("/question-catalogue")}>
                  <CardBody className="overflow-visible p-0">
                    <Image
                      alt="Deutschland"
                      className="w-full object-cover h-[140px]"
                      radius="lg"
                      shadow="sm"
                      src={`/states/deutschland.jpg`}
                      width="100%"
                    />
                  </CardBody>
                  <CardFooter className="text-small justify-between">
                    <b>{allTranslations.main_question_catalogue_all_question}</b>
                    <p className="text-default-500">DE</p>
                  </CardFooter>
                </Card>
                {states && states.map((state: State) =>
                  <Card key={state.code} isPressable onPress={() => router.push(`/question-catalogue/${state.code.toUpperCase()}`)}>
                    <CardBody className="overflow-visible p-0">
                      <Image
                        alt={state.name}
                        className="w-full object-cover h-[140px]"
                        radius="lg"
                        shadow="sm"
                        src={`/states/flag/${state.name}.svg`}
                        width="100%"
                      />
                    </CardBody>
                    <CardFooter className="text-small justify-between">
                      <b>{state.name}</b>
                      <p className="text-default-500">{state.code}</p>
                    </CardFooter>
                  </Card>)}
              </div>
            </CardBody>
          </Card>
        </>
      }
    </div >
  );
}
