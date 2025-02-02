"use client";

import ScreenshotSlider from "@/components/screenshot-slider";
import StateDropdown from "@/components/settings/state-dropdown";
import { statesData } from "@/data/data";
import { ArrowRightIcon } from "@/icons/ArrowRightIcon";
import { getUserData } from "@/services/user";
import { State } from "@/types/state";
import { User } from "@/types/user";
import { Capacitor } from "@capacitor/core";
import { LocalNotifications } from "@capacitor/local-notifications";
import { Alert, Card, CardBody, CardFooter, CardHeader, Image, Spinner } from "@heroui/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { v4 as uuid } from 'uuid';

export default function Home() {
  const [user, setUser] = useState<User>();
  const [states, setState] = useState<State[]>();
  const router = useRouter()
  const [showLoading, setShowLoading] = useState(Capacitor.isNativePlatform());

  const getNextNotificationTime = () => {
    const now = new Date();
    const nextNotification = new Date(now);
    nextNotification.setDate(now.getDate() + 1);
    nextNotification.setHours(9, 0, 0, 0); // Example: schedule for 9 AM next day
    return nextNotification;
  };

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) {
      return;
    }

    (async () => {
      const permission = await LocalNotifications.checkPermissions();
      //'prompt' | 'prompt-with-rationale' | 'granted' | 'denied'
      if (permission.display === "granted") {
        LocalNotifications.schedule({
          notifications: [
            {
              title: "Don´t forget to study",
              body: "Continue your preparation for the Einbürgerungstest",
              id: uuid(),
              largeIcon: "splash",
              schedule: {
                at: getNextNotificationTime(),
                repeats: true,
                every: "day",
                allowWhileIdle: true
              },
            }
          ]
        });
        return;
      }

      else if (permission.display === "prompt" || permission.display === "prompt-with-rationale") {
        await LocalNotifications.requestPermissions();
      }
    })();
  }, []);

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
          <Alert color="warning" title="Note: This is not an official Einbürgerungstest. This platform is designed to help you prepare for the Einbürgerungstest." />
          <Alert color="danger" title="This website is a private offering and not an official site of the Federal Office for Migration and Refugees (BAMF). The Einbürgerungstest can only be carried out at the BAMF." />

          <ScreenshotSlider />
          <Card>
            <CardHeader>
              <p className="font-bold text-2xl text-black dark:text-white">Frequently Asked Questions</p>
            </CardHeader>
            <CardBody>
              <div className="flex flex-col gap-2">
                <Card className="p-2">
                  <p className="font-bold text-default-500">How many questions are there in the Einbürgerungstest?</p>
                  <p className="text-default-500">The test consists of 33 questions.</p>
                </Card>
                <Card className="p-2">
                  <p className="font-bold text-default-500">How many questions do I have to answer correctly?</p>
                  <p className="text-default-500">At least 17 questions must be answered correctly to pass the test.</p>
                </Card>
                <Card className="p-2">
                  <p className="font-bold text-default-500">Where can I prepare for the test?</p>
                  <p className="text-default-500">There are many resources, including online tests, books, and preparation courses.</p>
                </Card>
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <p className="font-bold text-2xl text-black dark:text-white">Prüfungstellen</p>
            </CardHeader>
            <CardBody>
              <p className="text-default-500">Please select your state, the Prüfungstellen will open in a new tab.</p>
              <StateDropdown user={user} handleSelectState={(state: State) => state && window.open(`https://www.bamf.de/SharedDocs/Anlagen/DE/Integration/Einbuergerung/Pruefstellen-${state.code.toUpperCase()}.xlsx`, "_blank")} />
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <p className="font-bold text-2xl text-black dark:text-white">Welcome to our online learning platform for the &quot;Leben in Deutschland&quot; test!</p>
            </CardHeader>
            <CardBody>
              <p className="text-default-500">Our platform offers comprehensive resources, including detailed study materials, practice exams, and interactive tools to help you prepare effectively for the test.</p>
              <p className="text-default-500 mt-2">Check your progress with our interactive tools and track your improvement over time.</p>
              <p className="text-default-500 mt-2">Enjoy a seamless learning experience with no ads, ensuring you stay focused on your preparation.</p>
              <p className="text-default-500 mt-2">Join our community of learners and achieve success in your &quot;Leben in Deutschland&quot; test.</p>
            </CardBody>
          </Card>

          <Card className="p-2" isPressable onPress={() => router.push("/dashboard")}>
            <CardHeader>
              <p className="font-bold text-2xl text-black dark:text-white">Interactive Tool</p>
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
                <p className="text-default-500">
                  Our interactive tool provides comprehensive insights into your learning progress.
                  You can track your daily progress, view detailed user statistics, and assess your exam readiness.
                  Additionally, the tool offers easy access to preparation materials and mock tests, ensuring you are well-prepared for the &quot;Leben in Deutschland&quot; test.
                </p>
                <p className="text-default-500 mt-2">
                  The tool is designed to be user-friendly and intuitive, making it easy for you to navigate through various features.
                  Stay motivated and on track with personalized feedback and recommendations based on your performance.
                </p>
                <p className="text-default-500 mt-2">
                  From visualized progress charts to advanced filters, you can analyze your strengths and areas that need improvement.
                  Compare your scores with peers and leverage actionable insights to refine your study plan.
                  The mock tests simulate real exam conditions, helping you build confidence while preparing for your test.
                </p>
                <span className="flex justify-end"><p className="font-bold text-default-500">To the tool</p><ArrowRightIcon /></span>
              </div>
            </CardBody>
          </Card>

          <Card className="p-2" isPressable onPress={() => router.push("/mock")}>
            <CardHeader>
              <p className="font-bold text-2xl text-black dark:text-white">Mock exam</p>
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
                <p className="text-default-500">
                  Our mock exam simulates the real &quot;Leben in Deutschland&quot; test with 33 randomly generated multiple-choice questions.
                  You will have 60 minutes to complete the exam, and there is a progress tracker to see which questions you have flagged and revisit them.
                </p>
                <p className="text-default-500 mt-2">
                  The exam is designed to mimic the actual test conditions, helping you build confidence and assess your readiness.
                  Each question has 4 options, and you can cancel the exam anytime if needed.
                </p>
                <span className="flex justify-end"><p className="font-bold text-default-500">To the mock exam</p><ArrowRightIcon /></span>
              </div>
            </CardBody>
          </Card>

          <Card className="p-2" isPressable onPress={() => router.push("/prepare")}>
            <CardHeader>
              <p className="font-bold text-2xl text-black dark:text-white">Prepare for all questions</p>
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
                <p className="text-default-500">
                  Get ready for the &quot;Leben in Deutschland&quot; test by preparing with all available questions.
                  Our preparation tool provides access to a comprehensive set of questions, ensuring you cover every topic.
                </p>
                <p className="text-default-500 mt-2">
                  Practice at your own pace and track your progress. The tool offers detailed explanations for each question, helping you understand the material thoroughly.
                </p>
                <p className="text-default-500">
                  You can flag questions, and the data will be reflected in the dashboard with stats. All the data will be saved so you can easily check later.
                </p>
                <p className="text-default-500 mt-2">
                  Additionally, questions can be translated into Hindi, Russian, Turkish, and many more languages, making it easier for you to understand and prepare.
                </p>
                <span className="flex justify-end"><p className="font-bold text-default-500">Start preparing</p><ArrowRightIcon /></span>
              </div>
            </CardBody>
          </Card>
          <Card>
            <CardHeader>
              <p className="font-bold text-2xl text-black dark:text-white">Question Catalogue</p>
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
                    <b>All Questions</b>
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
