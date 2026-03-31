"use client";

import GermanyMap from "@/components/germany-map";
import { evaluationData, getTranslations, statesData } from "@/data/data";
import { EvaluationData } from "@/types/evaluation";
import { getUserData } from "@/services/user";
import { siteConfig } from "@/config/site";
import { State } from "@/types/state";
import { User } from "@/types/user";
import { Capacitor } from "@capacitor/core";
import {
  Accordion,
  AccordionItem,
  Button,
  Card,
  CardBody,
  Spinner,
} from "@heroui/react";
import { Link } from "@heroui/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useCallback } from "react";

/* ------------------------------------------------------------------ */
/*  Intersection-observer hook – triggers CSS animation when visible   */
/* ------------------------------------------------------------------ */
function useInView(threshold = 0.15) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setVisible(true); obs.unobserve(el); } },
      { threshold }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [threshold]);

  return { ref, visible };
}

/* ------------------------------------------------------------------ */
/*  Animated section wrapper                                           */
/* ------------------------------------------------------------------ */
function AnimatedSection({
  children,
  className = "",
  delay = "",
  id,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: string;
  id?: string;
}) {
  const { ref, visible } = useInView();
  return (
    <section
      ref={ref}
      id={id}
      className={`${visible ? `animate-fade-in-up ${delay}` : "opacity-0"} ${className}`}
    >
      {children}
    </section>
  );
}

/* ------------------------------------------------------------------ */
/*  Hero morph text – animates between LiD ↔ Einbürgerungstest        */
/* ------------------------------------------------------------------ */
function HeroMorphText({ t }: { t: Record<string, string> }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [animClass, setAnimClass] = useState("hero-morph-enter");

  const terms = [
    {
      name: "Leben in Deutschland",
      label: t.hero_lid_label,
      desc: t.hero_lid_desc,
      colors: "from-foreground to-foreground/80",
      accent: "text-red-500",
    },
    {
      name: "Einbürgerungstest",
      label: t.hero_ebt_label,
      desc: t.hero_ebt_desc,
      colors: "from-red-500 to-yellow-500",
      accent: "text-yellow-500",
    },
  ];

  const cycle = useCallback(() => {
    setAnimClass("hero-morph-exit");
    setTimeout(() => {
      setActiveIndex((prev) => (prev + 1) % terms.length);
      setAnimClass("hero-morph-enter");
    }, 500);
  }, [terms.length]);

  useEffect(() => {
    const interval = setInterval(cycle, 4000);
    return () => clearInterval(interval);
  }, [cycle]);

  const current = terms[activeIndex];

  return (
    <div className="flex flex-col items-center gap-4 min-h-[180px] sm:min-h-[200px]">
      {/* Animated term name */}
      <div className={`${animClass} flex flex-col items-center gap-2`}>
        <span className={`inline-block px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-widest glass-card ${current.accent}`}>
          {current.label}
        </span>
        <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-extrabold tracking-tight leading-[1.1]">
          <span className={`bg-gradient-to-r ${current.colors} bg-clip-text text-transparent`}>
            {current.name}
          </span>
        </h1>
        <p className="text-sm sm:text-base text-default-500 max-w-lg leading-relaxed text-center px-4">
          {current.desc}
        </p>
      </div>

      {/* Connector dots */}
      <div className="flex items-center gap-2 hero-connector-pulse">
        <span className={`h-2 w-2 rounded-full ${activeIndex === 0 ? "bg-foreground" : "bg-default-300"} transition-colors`} />
        <span className="text-xs text-default-400 font-medium">{t.hero_transition_connector}</span>
        <span className={`h-2 w-2 rounded-full ${activeIndex === 1 ? "bg-danger" : "bg-default-300"} transition-colors`} />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  JSON-LD structured data for SEO & AI crawlers                      */
/* ------------------------------------------------------------------ */
function LandingPageJsonLd({ evalData, avgWait }: { evalData: EvaluationData; avgWait: number }) {
  const lastSync = evalData.lastSyncAt.split(" ")[0];
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebApplication",
        name: "Leben in Deutschland - Einbürgerungstest Vorbereitung",
        url: "https://www.lebenindeutschland.org",
        applicationCategory: "EducationalApplication",
        operatingSystem: "Web, Android",
        offers: { "@type": "Offer", price: "0", priceCurrency: "EUR" },
        description:
          "Free, open-source platform to prepare for the German Einbürgerungstest (citizenship test). Practice 300+ questions, take mock exams, and track your progress.",
        inLanguage: ["de", "en"],
        featureList: [
          "300+ practice questions",
          "Realistic 33-question mock exams with 60-minute timer",
          "Progress tracking with visual charts",
          "Multi-language question translations",
          "Exam center directory for all 16 German states",
          "No ads, no signup required",
          "Live BAMF evaluation status tracker",
        ],
      },
      {
        "@type": "FAQPage",
        mainEntity: [
          {
            "@type": "Question",
            name: "What is \"Leben in Deutschland\"?",
            acceptedAnswer: { "@type": "Answer", text: "\"Leben in Deutschland\" (Living in Germany) is an official knowledge test administered by the German Federal Office for Migration and Refugees (BAMF). It is designed for people who hold a permanent residence permit and want to demonstrate their knowledge of German society, politics, history, and legal system." },
          },
          {
            "@type": "Question",
            name: "What is the Einbürgerungstest?",
            acceptedAnswer: { "@type": "Answer", text: "The Einbürgerungstest (naturalization test) is the official citizenship test for people who want to become German citizens. It tests knowledge of Germany's legal and social system, values, and history. Passing this test is one of the requirements for obtaining German citizenship through naturalization." },
          },
          {
            "@type": "Question",
            name: "What is the difference between \"Leben in Deutschland\" and the Einbürgerungstest?",
            acceptedAnswer: { "@type": "Answer", text: "Both tests use the same pool of 300 general questions plus 10 state-specific questions per federal state. The key differences are: purpose (permanent residents vs. citizenship seekers), pass threshold (15/33 for LiD vs. 17/33 for Einbürgerungstest), and legal effect (integration requirements vs. naturalization requirement)." },
          },
          {
            "@type": "Question",
            name: "How many questions are on the test?",
            acceptedAnswer: { "@type": "Answer", text: "The test consists of 33 multiple-choice questions. 30 questions are drawn from a general pool of 300 questions. The remaining 3 questions are specific to the federal state (Bundesland) where you take the test." },
          },
          {
            "@type": "Question",
            name: "How many questions do I need to answer correctly to pass?",
            acceptedAnswer: { "@type": "Answer", text: "For the Einbürgerungstest, you need at least 17 out of 33 correct answers. For the \"Leben in Deutschland\" test, you need at least 15 out of 33 correct answers." },
          },
          {
            "@type": "Question",
            name: "How long do I have to complete the test?",
            acceptedAnswer: { "@type": "Answer", text: "You have 60 minutes to complete all 33 questions." },
          },
          {
            "@type": "Question",
            name: "What topics are covered in the test?",
            acceptedAnswer: { "@type": "Answer", text: "The questions cover Democracy & Politics, Law & Governance, History & Geography, Economy & Employment, Education & Religion, Rights & Freedoms, and state-specific questions about your Bundesland." },
          },
          {
            "@type": "Question",
            name: "Are there state-specific questions?",
            acceptedAnswer: { "@type": "Answer", text: "Yes, 3 out of 33 questions are specific to the German federal state where you are registered to take the test. Each state has 10 state-specific questions, and 3 are randomly selected." },
          },
          {
            "@type": "Question",
            name: "Where can I take the test?",
            acceptedAnswer: { "@type": "Answer", text: "The test can only be taken at authorized examination centers (Prüfstellen) designated by the BAMF, typically at adult education centers (Volkshochschulen) or other certified institutions throughout all 16 German states." },
          },
          {
            "@type": "Question",
            name: "How much does the test cost?",
            acceptedAnswer: { "@type": "Answer", text: "The test fee is 25 euros, payable when you register at your local examination center." },
          },
          {
            "@type": "Question",
            name: "Can I retake the test if I fail?",
            acceptedAnswer: { "@type": "Answer", text: "Yes, you can retake the test as many times as needed. There is no limit on attempts, but you must pay the 25 euro fee each time." },
          },
          {
            "@type": "Question",
            name: "Is this platform free?",
            acceptedAnswer: { "@type": "Answer", text: "Yes, completely free. There are no ads, no paywalls, no subscriptions, and no hidden costs. The platform is open-source." },
          },
          {
            "@type": "Question",
            name: "Do I need to create an account?",
            acceptedAnswer: { "@type": "Answer", text: "No. You can start practicing immediately without signing up. All progress is saved locally on your device and never sent to any server." },
          },
          /* ── Evaluation / result waiting time FAQs (bilingual for SEO) ── */
          {
            "@type": "Question",
            name: "When will I get my Einbürgerungstest result?",
            acceptedAnswer: { "@type": "Answer", text: `The BAMF typically evaluates exam results within approximately ${avgWait} days after the exam date. Currently, the exam from ${evalData.examDate} is being evaluated (as of ${lastSync}). Waiting times may vary depending on the volume of exams.` },
          },
          {
            "@type": "Question",
            name: "Wann bekomme ich mein Ergebnis vom Einbürgerungstest?",
            acceptedAnswer: { "@type": "Answer", text: `Das BAMF wertet die Prüfungen in der Regel innerhalb von ${avgWait} Tagen nach dem Prüfungstermin aus. Aktuell wird der Prüfungstermin vom ${evalData.examDate} ausgewertet (Stand: ${lastSync}). Die Wartezeit kann je nach Prüfungsaufkommen variieren.` },
          },
          {
            "@type": "Question",
            name: "Which exam date is the BAMF currently evaluating?",
            acceptedAnswer: { "@type": "Answer", text: `The BAMF is currently evaluating results from the exam date ${evalData.examDate}. This information is automatically synced daily from the BAMF portal (last sync: ${lastSync}).` },
          },
          {
            "@type": "Question",
            name: "Welcher Prüfungstermin wird aktuell vom BAMF ausgewertet?",
            acceptedAnswer: { "@type": "Answer", text: `Das BAMF wertet aktuell die Ergebnisse des Prüfungstermins vom ${evalData.examDate} aus. Diese Information wird täglich automatisch vom BAMF-Portal abgerufen und aktualisiert (Letzte Synchronisierung: ${lastSync}).` },
          },
          {
            "@type": "Question",
            name: "How long does the BAMF take to evaluate the Einbürgerungstest?",
            acceptedAnswer: { "@type": "Answer", text: `Based on the last ${evalData.history.length} evaluation cycles, the average waiting time between the exam date and results publication is approximately ${avgWait} days. This duration can vary depending on exam volume and time of year.` },
          },
          {
            "@type": "Question",
            name: "Wie lange dauert die Auswertung des Einbürgerungstests?",
            acceptedAnswer: { "@type": "Answer", text: `Basierend auf den letzten ${evalData.history.length} Auswertungszyklen beträgt die durchschnittliche Wartezeit zwischen Prüfungstermin und Ergebnisveröffentlichung etwa ${avgWait} Tage. Diese Dauer kann je nach Prüfungsaufkommen und Jahreszeit schwanken.` },
          },
        ],
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Home", item: "https://www.lebenindeutschland.org" },
          { "@type": "ListItem", position: 2, name: "Dashboard", item: "https://www.lebenindeutschland.org/dashboard" },
          { "@type": "ListItem", position: 3, name: "Mock Exam", item: "https://www.lebenindeutschland.org/mock" },
          { "@type": "ListItem", position: 4, name: "Prepare", item: "https://www.lebenindeutschland.org/prepare" },
        ],
      },
      /* ── Dataset: BAMF Evaluation Timeline ── */
      {
        "@type": "Dataset",
        name: "BAMF Einbürgerungstest Evaluation Timeline",
        alternateName: "BAMF Auswertungsverlauf Einbürgerungstest",
        description: `Timeline of BAMF exam evaluation dates for the Einbürgerungstest / Leben in Deutschland test. Currently evaluating exam date ${evalData.examDate}. Average evaluation waiting time: ~${avgWait} days. Last synced: ${lastSync}.`,
        url: "https://www.lebenindeutschland.org",
        license: "https://opensource.org/licenses/MIT",
        isAccessibleForFree: true,
        creator: {
          "@type": "Organization",
          name: "Leben in Deutschland",
          url: "https://www.lebenindeutschland.org",
        },
        temporalCoverage: evalData.history.length > 0
          ? `${parseDEDate(evalData.history[0].examDate).toISOString().split("T")[0]}/${parseDEDate(evalData.history[evalData.history.length - 1].checkedAt).toISOString().split("T")[0]}`
          : undefined,
        variableMeasured: [
          {
            "@type": "PropertyValue",
            name: "Current exam date being evaluated",
            value: evalData.examDate,
          },
          {
            "@type": "PropertyValue",
            name: "Average evaluation waiting time (days)",
            value: avgWait,
            unitText: "days",
          },
          {
            "@type": "PropertyValue",
            name: "Total evaluation cycles tracked",
            value: evalData.history.length,
          },
        ],
        dateModified: evalData.lastSyncAt,
        keywords: [
          "BAMF", "Einbürgerungstest", "Ergebnis", "Auswertung", "Wartezeit",
          "Leben in Deutschland", "result", "evaluation", "waiting time",
          "Prüfungsergebnis", "citizenship test Germany",
        ],
      },
    ],
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
    />
  );
}


/* ------------------------------------------------------------------ */
/*  BAMF Evaluation – stat cards + horizontal SVG timeline             */
/* ------------------------------------------------------------------ */
function parseDEDate(dateStr: string): Date {
  const [d, m, y] = dateStr.split(".");
  return new Date(Number(y), Number(m) - 1, Number(d));
}

function daysBetween(a: Date, b: Date): number {
  return Math.round(Math.abs(b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24));
}

function BamfEvaluationSection({
  t,
  data,
}: {
  t: Record<string, string>;
  data: EvaluationData;
}) {
  /* compute average wait from history */
  const { avgWait, recentHistory } = useMemo(() => {
    const waits = data.history.map((e) =>
      daysBetween(parseDEDate(e.examDate), parseDEDate(e.checkedAt))
    );
    const sorted = [...waits].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    const median =
      sorted.length % 2 !== 0
        ? sorted[mid]
        : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
    return {
      avgWait: median,
      recentHistory: data.history.slice(-10),
    };
  }, [data]);

  /* SVG timeline dimensions */
  const nodeCount = recentHistory.length;
  const nodeSpacing = 120;
  const svgWidth = (nodeCount - 1) * nodeSpacing + 80;
  const svgHeight = 160;
  const yExam = 40;
  const yLine = 75;
  const yResult = 115;

  return (
    <div className="flex flex-col gap-6">
      {/* Section header */}
      <div className="text-center">
        <div className="inline-flex items-center gap-2 mb-3">
          {/* BAMF badge icon */}
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-primary" aria-hidden="true">
            <path d="M9 5H2v7l6.29 6.29c.94.94 2.48.94 3.42 0l3.58-3.58c.94-.94.94-2.48 0-3.42L9 5Z" />
            <path d="M6 9.01V9" />
            <path d="m15 5 6.3 6.3a2.4 2.4 0 0 1 0 3.4L17 19" />
          </svg>
          <h2 className="text-2xl sm:text-3xl font-bold text-foreground">{t.eval_section_title}</h2>
        </div>
        <p className="text-sm sm:text-base text-default-500 max-w-2xl mx-auto leading-relaxed">{t.eval_section_subtitle}</p>
      </div>

      {/* Stat cards – 3 columns */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
        {/* Current Exam Date */}
        <div className="glass-card rounded-2xl p-5 sm:p-6 flex items-start gap-4">
          <div className="flex-shrink-0 flex items-center justify-center w-11 h-11 rounded-xl bg-primary/10">
            <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-primary" aria-hidden="true">
              <rect width="18" height="18" x="3" y="4" rx="2" ry="2" />
              <line x1="16" x2="16" y1="2" y2="6" />
              <line x1="8" x2="8" y1="2" y2="6" />
              <line x1="3" x2="21" y1="10" y2="10" />
              <path d="m9 16 2 2 4-4" />
            </svg>
          </div>
          <div className="flex flex-col gap-1 min-w-0">
            <p className="text-xs text-default-400 font-medium uppercase tracking-wide">{t.eval_current_exam}</p>
            <p className="text-xl sm:text-2xl font-bold text-foreground truncate">{data.examDate}</p>
            <p className="text-xs text-default-400">{t.eval_current_exam_desc}</p>
          </div>
        </div>

        {/* Last Checked */}
        <div className="glass-card rounded-2xl p-5 sm:p-6 flex items-start gap-4">
          <div className="flex-shrink-0 flex items-center justify-center w-11 h-11 rounded-xl bg-success/10">
            <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-success" aria-hidden="true">
              <path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
          </div>
          <div className="flex flex-col gap-1 min-w-0">
            <p className="text-xs text-default-400 font-medium uppercase tracking-wide">{t.eval_last_checked}</p>
            <p className="text-xl sm:text-2xl font-bold text-foreground truncate">{data.lastSyncAt.split(" ")[0]}</p>
            <p className="text-xs text-default-400">{t.eval_last_checked_desc}</p>
          </div>
        </div>

        {/* Average Wait Time */}
        <div className="glass-card rounded-2xl p-5 sm:p-6 flex items-start gap-4">
          <div className="flex-shrink-0 flex items-center justify-center w-11 h-11 rounded-xl bg-warning/10">
            <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-warning" aria-hidden="true">
              <path d="M5 22h14" />
              <path d="M5 2h14" />
              <path d="M17 22v-4.172a2 2 0 0 0-.586-1.414L12 12l-4.414 4.414A2 2 0 0 0 7 17.828V22" />
              <path d="M7 2v4.172a2 2 0 0 0 .586 1.414L12 12l4.414-4.414A2 2 0 0 0 17 6.172V2" />
            </svg>
          </div>
          <div className="flex flex-col gap-1 min-w-0">
            <p className="text-xs text-default-400 font-medium uppercase tracking-wide">{t.eval_avg_wait}</p>
            <p className="text-xl sm:text-2xl font-bold text-foreground">~{avgWait} <span className="text-base font-normal text-default-500">{t.eval_days}</span></p>
            <p className="text-xs text-default-400">{t.eval_avg_wait_desc}</p>
          </div>
        </div>
      </div>

      {/* Horizontal SVG Timeline */}
      <div className="glass-card rounded-2xl p-4 sm:p-6">
        <div className="flex items-center gap-2 mb-4">
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-default-400" aria-hidden="true">
            <path d="M3 3v18h18" />
            <path d="m19 9-5 5-4-4-3 3" />
          </svg>
          <h3 className="text-sm sm:text-base font-semibold text-foreground">{t.eval_timeline_title}</h3>
        </div>

        <div className="overflow-x-auto eval-timeline-scroll pb-2 -mx-1 px-1">
          <svg
            viewBox={`0 0 ${svgWidth} ${svgHeight}`}
            width={svgWidth}
            height={svgHeight}
            className="block"
            role="img"
            aria-label={t.eval_timeline_title}
          >
            {/* Connecting line */}
            <line
              x1={40}
              y1={yLine}
              x2={40 + (nodeCount - 1) * nodeSpacing}
              y2={yLine}
              className="stroke-default-200 dark:stroke-default-100"
              strokeWidth="2"
              strokeDasharray="6 4"
            />

            {recentHistory.map((entry, i) => {
              const x = 40 + i * nodeSpacing;
              const waitDays = daysBetween(parseDEDate(entry.examDate), parseDEDate(entry.checkedAt));
              const isLast = i === recentHistory.length - 1;

              return (
                <g key={i}>
                  {/* Vertical connector: exam → node → result */}
                  <line
                    x1={x} y1={yExam + 14}
                    x2={x} y2={yLine - 8}
                    className="stroke-primary/30"
                    strokeWidth="1.5"
                  />
                  <line
                    x1={x} y1={yLine + 8}
                    x2={x} y2={yResult - 6}
                    className="stroke-success/30"
                    strokeWidth="1.5"
                  />

                  {/* Exam date label (top) */}
                  <text
                    x={x}
                    y={yExam - 6}
                    textAnchor="middle"
                    className="fill-default-400 text-[9px] font-medium uppercase"
                  >
                    {t.eval_timeline_exam}
                  </text>
                  <text
                    x={x}
                    y={yExam + 8}
                    textAnchor="middle"
                    className="fill-foreground text-[10px] font-semibold"
                  >
                    {entry.examDate}
                  </text>

                  {/* Center node circle */}
                  <circle
                    cx={x}
                    cy={yLine}
                    r={isLast ? 7 : 5}
                    className={isLast
                      ? "fill-primary stroke-primary/30 eval-node-pulse"
                      : "fill-success stroke-success/30"
                    }
                    strokeWidth="3"
                  />

                  {/* Days badge inside node (only for last) */}
                  {isLast && (
                    <text
                      x={x}
                      y={yLine + 3.5}
                      textAnchor="middle"
                      className="fill-white text-[7px] font-bold"
                    >
                      {waitDays}
                    </text>
                  )}

                  {/* Result date label (bottom) */}
                  <text
                    x={x}
                    y={yResult + 2}
                    textAnchor="middle"
                    className="fill-default-400 text-[9px] font-medium uppercase"
                  >
                    {t.eval_timeline_result}
                  </text>
                  <text
                    x={x}
                    y={yResult + 16}
                    textAnchor="middle"
                    className="fill-foreground text-[10px] font-semibold"
                  >
                    {entry.checkedAt}
                  </text>

                  {/* Wait days badge (small pill between lines) */}
                  {!isLast && (
                    <>
                      <rect
                        x={x - 14}
                        y={yLine - 22}
                        width={28}
                        height={14}
                        rx={7}
                        className="fill-default-100 dark:fill-default-50"
                      />
                      <text
                        x={x}
                        y={yLine - 12}
                        textAnchor="middle"
                        className="fill-default-500 text-[8px] font-medium"
                      >
                        {waitDays}d
                      </text>
                    </>
                  )}
                </g>
              );
            })}
          </svg>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Explore by State – interactive map + "View all" links              */
/* ------------------------------------------------------------------ */
function ExploreByStateMap({
  t,
  states,
}: {
  t: Record<string, string>;
  states: State[];
}) {
  return (
    <div className="flex flex-col items-center gap-6">
      {/* Map */}
      <GermanyMap translations={t} states={states} />

      {/* View-all links */}
      <div className="flex flex-col sm:flex-row items-center gap-3 sm:gap-4 mt-2">
        <Link
          href="/question-catalogue"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl glass-card text-sm font-semibold text-foreground hover:bg-foreground/5 transition-colors"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20" />
          </svg>
          {t.map_view_all_questions}
        </Link>
      </div>
    </div>
  );
}

/* ================================================================== */
/*  HOME PAGE                                                          */
/* ================================================================== */
export default function Home() {
  const [user, setUser] = useState<User>();
  const [states, setState] = useState<State[]>(statesData());
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [showLoading, setShowLoading] = useState(true);
  const t = getTranslations(user?.appLanguage ?? "de");
  const evalData = useMemo(() => evaluationData(), []);
  const avgWait = useMemo(() => {
    const waits = evalData.history.map((e) =>
      daysBetween(parseDEDate(e.examDate), parseDEDate(e.checkedAt))
    );
    const sorted = [...waits].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 !== 0
      ? sorted[mid]
      : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
  }, [evalData]);

  useEffect(() => {
    setMounted(true);
    if (Capacitor.isNativePlatform()) {
      window.location.replace("/dashboard.html");
      return;
    }
    setShowLoading(false);
  }, []);

  useEffect(() => {
    const stateData = statesData();
    setState(stateData);
    const handleUserChange = () => {
      const tempUser = getUserData();
      if (tempUser !== null) setUser(tempUser);
    };
    window.addEventListener("user", handleUserChange);
    return () => window.removeEventListener("user", handleUserChange);
  }, []);

  /* ---- native-app redirect spinner ---- */
  if (!mounted || showLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Spinner size="lg" />
      </div>
    );
  }

  /* ---- web landing page ---- */
  return (
    <>
      <LandingPageJsonLd evalData={evalData} avgWait={avgWait} />

      <div className="flex flex-col gap-16 sm:gap-20 md:gap-24 pb-8">
        {/* ─── Disclaimer Banners ─── */}
        <div className="flex flex-col gap-2 animate-fade-in-up">
          <div className="rounded-xl border border-warning-200 bg-warning-50 dark:bg-warning-50/10 dark:border-warning-500/30 px-4 py-3">
            <p className="text-xs sm:text-sm text-warning-700 dark:text-warning-400">{t.alert1}</p>
          </div>
          <div className="rounded-xl border border-danger-200 bg-danger-50 dark:bg-danger-50/10 dark:border-danger-500/30 px-4 py-3">
            <p className="text-xs sm:text-sm text-danger-600 dark:text-danger-400">{t.alert2}</p>
          </div>
        </div>

        {/* ─── Hero Section ─── */}
        <section className="relative overflow-hidden flex flex-col items-center text-center gap-5 sm:gap-6 pt-4 sm:pt-8 md:pt-12">
          {/* Background animation layer – 3D floating geometry */}
          <div className="absolute inset-0 pointer-events-none hero-3d-scene" aria-hidden="true">
            {/* Soft ambient glow behind content */}
            <div className="hero-ambient-glow absolute top-1/2 left-1/2 w-[600px] h-[600px] sm:w-[800px] sm:h-[800px] rounded-full" />

            {/* Large rotating ring – the hero centerpiece */}
            <div className="hero-ring-wrapper absolute top-1/2 left-1/2">
              <div className="hero-ring">
                <div className="hero-ring-inner" />
              </div>
            </div>

            {/* Floating orb 1 – red, top-right */}
            <div className="hero-orb hero-orb-1 absolute">
              <div className="hero-orb-sphere hero-orb-red" />
            </div>

            {/* Floating orb 2 – gold, bottom-left */}
            <div className="hero-orb hero-orb-2 absolute">
              <div className="hero-orb-sphere hero-orb-gold" />
            </div>

            {/* Floating orb 3 – dark, center-right */}
            <div className="hero-orb hero-orb-3 absolute">
              <div className="hero-orb-sphere hero-orb-dark" />
            </div>

            {/* Small accent orbs for depth */}
            <div className="hero-orb hero-orb-4 absolute">
              <div className="hero-orb-sphere hero-orb-red-sm" />
            </div>
            <div className="hero-orb hero-orb-5 absolute">
              <div className="hero-orb-sphere hero-orb-gold-sm" />
            </div>

            {/* Subtle perspective grid floor */}
            <div className="hero-grid-floor absolute bottom-0 left-1/2 w-[200%] h-[40%]" />
          </div>

          <div className="inline-flex items-center gap-2 rounded-full glass-card hero-shimmer px-4 py-1.5 animate-fade-in-up">
            <span className="h-2 w-2 rounded-full bg-success-500 animate-pulse" />
            <span className="text-xs sm:text-sm text-default-600 font-medium">{t.hero_badge}</span>
          </div>

          {/* Animated morph between Leben in Deutschland ↔ Einbürgerungstest */}
          <div className="animate-fade-in-up animate-fade-in-up-delay-1">
            <HeroMorphText t={t} />
          </div>

          <p className="text-base sm:text-lg md:text-xl text-default-500 max-w-2xl leading-relaxed px-2 animate-fade-in-up animate-fade-in-up-delay-2">
            {t.hero_subtitle}
          </p>

          <div className="flex flex-col sm:flex-row gap-3 mt-2 w-full sm:w-auto px-4 sm:px-0 animate-fade-in-up animate-fade-in-up-delay-3">
            <Button
              size="lg"
              color="primary"
              variant="shadow"
              className="font-semibold w-full sm:w-auto sm:px-8"
              onPress={() => router.push("/prepare")}
            >
              {t.hero_cta_start}
            </Button>
            <Button
              size="lg"
              variant="bordered"
              className="font-semibold w-full sm:w-auto sm:px-8"
              onPress={() => router.push("/mock")}
            >
              {t.hero_cta_mock}
            </Button>
          </div>
        </section>

        {/* ─── Stats Bar ─── */}
        <AnimatedSection>
          <div className="relative">
            {/* Decorative SVG */}
            <svg className="absolute -top-6 -right-4 w-12 h-12 text-default-200 dark:text-default-100 opacity-30 animate-float" viewBox="0 0 100 100" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <polygon points="50,5 95,27.5 95,72.5 50,95 5,72.5 5,27.5" />
            </svg>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3 sm:gap-4">
              {[
                { value: "300+", label: t.stats_questions, icon: (
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-primary/40" aria-hidden="true"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"/></svg>
                )},
                { value: "33", label: t.stats_test_questions, icon: (
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-warning/40" aria-hidden="true"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
                )},
                { value: "16", label: t.stats_states, icon: (
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-success/40" aria-hidden="true"><path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0"/><circle cx="12" cy="10" r="3"/></svg>
                )},
                { value: "60", label: t.stats_time, icon: (
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-secondary/40" aria-hidden="true"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                )},
                { value: "17/33", label: t.stats_pass, icon: (
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-danger/40" aria-hidden="true"><path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z"/><path d="m9 12 2 2 4-4"/></svg>
                )},              ].map((stat) => (
                <div
                  key={stat.label}
                  className="glass-card rounded-2xl p-4 sm:p-6 text-center animate-count-pulse cursor-default flex flex-col items-center gap-2"
                >
                  {stat.icon}
                  <p className="text-2xl sm:text-3xl md:text-4xl font-bold text-foreground">{stat.value}</p>
                  <p className="text-xs sm:text-sm text-default-500 mt-1">{stat.label}</p>
                </div>
              ))}
            </div>
          </div>
        </AnimatedSection>

        {/* ─── BAMF Evaluation Status ─── */}
        <AnimatedSection>
          <div id="bamf-evaluation">
            <BamfEvaluationSection t={t} data={evalData} />
          </div>
        </AnimatedSection>

        {/* ─── Feature Cards (primary 3) ─── */}
        <AnimatedSection>
          <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-4 sm:gap-6">
            {/* Prepare */}
            <Card
              isPressable
              onPress={() => router.push("/prepare")}
              className="group gradient-border-hover border border-default-200 dark:border-default-100 transition-all duration-300 hover:-translate-y-1"
            >
              <CardBody className="p-5 sm:p-6 gap-4 flex flex-col">
                <div className="flex items-center justify-center w-12 h-12 rounded-2xl bg-primary/10 text-primary transition-transform group-hover:scale-110">
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20" />
                    <path d="m9 9.5 2 2 4-4" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-lg sm:text-xl font-bold text-foreground">{t.feature_prepare_title}</h3>
                  <p className="text-sm sm:text-base text-default-500 mt-2 leading-relaxed">{t.feature_prepare_desc}</p>
                </div>
                <span className="text-primary font-semibold text-sm mt-auto group-hover:translate-x-1 transition-transform inline-flex items-center gap-1">
                  {t.main_prepare_href_text}
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12h14" /><path d="m12 5 7 7-7 7" /></svg>
                </span>
              </CardBody>
            </Card>

            {/* Mock */}
            <Card
              isPressable
              onPress={() => router.push("/mock")}
              className="group gradient-border-hover border border-default-200 dark:border-default-100 transition-all duration-300 hover:-translate-y-1"
            >
              <CardBody className="p-5 sm:p-6 gap-4 flex flex-col">
                <div className="flex items-center justify-center w-12 h-12 rounded-2xl bg-warning/10 text-warning transition-transform group-hover:scale-110">
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <circle cx="12" cy="12" r="10" />
                    <polyline points="12 6 12 12 16 14" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-lg sm:text-xl font-bold text-foreground">{t.feature_mock_title}</h3>
                  <p className="text-sm sm:text-base text-default-500 mt-2 leading-relaxed">{t.feature_mock_desc}</p>
                </div>
                <span className="text-warning font-semibold text-sm mt-auto group-hover:translate-x-1 transition-transform inline-flex items-center gap-1">
                  {t.main_mock_href_text}
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12h14" /><path d="m12 5 7 7-7 7" /></svg>
                </span>
              </CardBody>
            </Card>

            {/* Dashboard */}
            <Card
              isPressable
              onPress={() => router.push("/dashboard")}
              className="group gradient-border-hover border border-default-200 dark:border-default-100 transition-all duration-300 hover:-translate-y-1 sm:col-span-2 md:col-span-1"
            >
              <CardBody className="p-5 sm:p-6 gap-4 flex flex-col">
                <div className="flex items-center justify-center w-12 h-12 rounded-2xl bg-success/10 text-success transition-transform group-hover:scale-110">
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M3 3v18h18" />
                    <path d="m19 9-5 5-4-4-3 3" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-lg sm:text-xl font-bold text-foreground">{t.feature_dashboard_title}</h3>
                  <p className="text-sm sm:text-base text-default-500 mt-2 leading-relaxed">{t.feature_dashboard_desc}</p>
                </div>
                <span className="text-success font-semibold text-sm mt-auto group-hover:translate-x-1 transition-transform inline-flex items-center gap-1">
                  {t.main_dashboard_href_text}
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12h14" /><path d="m12 5 7 7-7 7" /></svg>
                </span>
              </CardBody>
            </Card>
          </div>
        </AnimatedSection>

        {/* ─── How It Works ─── */}
        <AnimatedSection id="how-it-works">
          <div className="relative text-center mb-8 sm:mb-10">
            {/* Decorative SVG */}
            <svg className="absolute -top-4 left-1/2 -translate-x-1/2 w-8 h-8 text-default-200 dark:text-default-100 opacity-40" viewBox="0 0 100 100" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path d="M50 5 L95 50 L50 95 L5 50 Z" />
            </svg>
            <h2 className="text-2xl sm:text-3xl font-bold text-foreground">{t.how_it_works_title}</h2>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6">
            {[
              { step: "01", title: t.how_it_works_step1_title, desc: t.how_it_works_step1_desc, icon: (
                <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0"/><circle cx="12" cy="10" r="3"/></svg>
              )},
              { step: "02", title: t.how_it_works_step2_title, desc: t.how_it_works_step2_desc, icon: (
                <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"/><path d="m9 9.5 2 2 4-4"/></svg>
              )},
              { step: "03", title: t.how_it_works_step3_title, desc: t.how_it_works_step3_desc, icon: (
                <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
              )},
              { step: "04", title: t.how_it_works_step4_title, desc: t.how_it_works_step4_desc, icon: (
                <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 3v18h18"/><path d="m19 9-5 5-4-4-3 3"/></svg>
              )},
            ].map((item) => (
              <div key={item.step} className="step-connector flex flex-col items-center text-center gap-3 p-3 sm:p-4">
          <div className="relative">
                  <div className="flex items-center justify-center w-14 h-14 sm:w-16 sm:h-16 rounded-2xl glass-card text-foreground">
                    {item.icon}
                  </div>
                  <span className="absolute -top-2 -right-2 text-[10px] font-bold bg-foreground text-background rounded-full w-6 h-6 flex items-center justify-center">
                    {item.step}
                  </span>
                </div>
                <h3 className="text-sm sm:text-base font-bold text-foreground">{item.title}</h3>
                <p className="text-xs sm:text-sm text-default-500 leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </AnimatedSection>

        {/* ─── Secondary Features (3 more) ─── */}
        <AnimatedSection>
          <div className="grid sm:grid-cols-3 gap-4 sm:gap-6">
            {[
              {
                title: t.feature_no_ads_title,
                desc: t.feature_no_ads_desc,
                icon: (
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10"/><path d="m9 12 2 2 4-4"/></svg>
                ),
              },
              {
                title: t.feature_multilang_title,
                desc: t.feature_multilang_desc,
                icon: (
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/></svg>
                ),
              },
              {
                title: t.feature_mobile_title,
                desc: t.feature_mobile_desc,
                icon: (
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect width="14" height="20" x="5" y="2" rx="2" ry="2"/><path d="M12 18h.01"/></svg>
                ),
              },
            ].map((feat) => (
              <div key={feat.title} className="glass-card rounded-2xl p-5 sm:p-6 flex flex-col gap-3 transition-all duration-300 hover:-translate-y-1">
                <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-foreground/5 text-foreground">
                  {feat.icon}
                </div>
                <h3 className="text-base sm:text-lg font-bold text-foreground">{feat.title}</h3>
                <p className="text-sm text-default-500 leading-relaxed">{feat.desc}</p>
              </div>
            ))}
          </div>
        </AnimatedSection>

        {/* ─── Download / Google Play ─── */}
        <AnimatedSection id="download">
          <div className="relative rounded-2xl overflow-hidden glass-card p-6 sm:p-8 md:p-10">
            {/* Background decoration */}
            <div className="absolute top-0 right-0 w-40 h-40 bg-success-500/5 rounded-full -translate-y-1/2 translate-x-1/2 animate-float" aria-hidden="true" />
            <div className="absolute bottom-0 left-0 w-32 h-32 bg-primary-500/5 rounded-full translate-y-1/2 -translate-x-1/2 animate-float-delayed" aria-hidden="true" />

            <div className="relative z-10 flex flex-col md:flex-row items-center gap-8 md:gap-12">
              {/* Phone mockup SVG */}
              <div className="flex-shrink-0 w-40 sm:w-48 md:w-56" aria-hidden="true">
                <svg viewBox="0 0 200 380" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-auto drop-shadow-xl">
                  {/* Phone body */}
                  <rect x="10" y="10" width="180" height="360" rx="28" className="fill-foreground/5 stroke-foreground/20" strokeWidth="2" />
                  <rect x="20" y="50" width="160" height="290" rx="4" className="fill-foreground/[0.03]" />
                  {/* Notch */}
                  <rect x="70" y="20" width="60" height="8" rx="4" className="fill-foreground/10" />
                  {/* Screen content - mini app preview */}
                  <rect x="30" y="65" width="140" height="24" rx="6" className="fill-primary/20" />
                  <rect x="30" y="100" width="60" height="60" rx="8" className="fill-success/15" />
                  <rect x="100" y="100" width="70" height="28" rx="4" className="fill-foreground/[0.06]" />
                  <rect x="100" y="134" width="50" height="12" rx="3" className="fill-foreground/[0.04]" />
                  <rect x="100" y="152" width="35" height="8" rx="2" className="fill-foreground/[0.03]" />
                  <rect x="30" y="175" width="140" height="1" className="fill-foreground/10" />
                  <rect x="30" y="190" width="65" height="65" rx="8" className="fill-warning/15" />
                  <rect x="105" y="190" width="65" height="65" rx="8" className="fill-danger/15" />
                  <rect x="30" y="268" width="140" height="20" rx="6" className="fill-primary/10" />
                  <rect x="30" y="296" width="100" height="14" rx="4" className="fill-foreground/[0.05]" />
                  {/* Home indicator */}
                  <rect x="75" y="350" width="50" height="5" rx="2.5" className="fill-foreground/15" />
                  {/* Android robot floating beside phone */}
                  <g transform="translate(155, 5) scale(0.5)" className="animate-float">
                    <path d="M30 45 C30 30 70 30 70 45" className="stroke-success fill-success/20" strokeWidth="3" strokeLinecap="round" />
                    <rect x="28" y="45" width="44" height="35" rx="8" className="fill-success/20 stroke-success" strokeWidth="2" />
                    <circle cx="40" cy="38" r="2.5" className="fill-success" />
                    <circle cx="60" cy="38" r="2.5" className="fill-success" />
                    <line x1="38" y1="20" x2="33" y2="28" className="stroke-success" strokeWidth="2" strokeLinecap="round" />
                    <line x1="62" y1="20" x2="67" y2="28" className="stroke-success" strokeWidth="2" strokeLinecap="round" />
                    <rect x="18" y="50" width="8" height="22" rx="4" className="fill-success/20 stroke-success" strokeWidth="2" />
                    <rect x="74" y="50" width="8" height="22" rx="4" className="fill-success/20 stroke-success" strokeWidth="2" />
                    <rect x="36" y="82" width="8" height="18" rx="4" className="fill-success/20 stroke-success" strokeWidth="2" />
                    <rect x="56" y="82" width="8" height="18" rx="4" className="fill-success/20 stroke-success" strokeWidth="2" />
                  </g>
                </svg>
              </div>

              {/* Content */}
              <div className="flex flex-col items-center md:items-start text-center md:text-left gap-4">
                <h2 className="text-2xl sm:text-3xl font-bold text-foreground">{t.download_title}</h2>
                <p className="text-sm sm:text-base text-default-500 max-w-lg leading-relaxed">
                  {t.download_subtitle}
                </p>

                {/* Feature pills */}
                <div className="flex flex-wrap gap-2 justify-center md:justify-start mt-1">
                  {[
                    { label: t.download_features_offline, icon: "M12 18v-3m0-3v.01M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z" },
                    { label: t.download_features_reminders, icon: "M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 0 1-3.46 0" },
                    { label: t.download_features_tts, icon: "M11 5 6 9H2v6h4l5 4V5zM19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07" },
                    { label: t.download_features_free, icon: "M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10" },
                  ].map((feat) => (
                    <span key={feat.label} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full glass-card text-xs sm:text-sm font-medium text-default-600">
                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-success" aria-hidden="true">
                        <path d={feat.icon} />
                      </svg>
                      {feat.label}
                    </span>
                  ))}
                </div>

                {/* Play Store button + rating */}
                <div className="flex flex-col sm:flex-row items-center gap-3 mt-2">
                  <Link
                    isExternal
                    href={siteConfig.links.playStore}
                    className="inline-flex items-center gap-3 px-6 py-3 rounded-xl bg-foreground text-background font-semibold text-sm sm:text-base hover:opacity-90 transition-opacity shadow-lg"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                      <path d="M3.609 1.814L13.792 12 3.61 22.186a.996.996 0 0 1-.61-.92V2.734a1 1 0 0 1 .609-.92zm10.89 10.893l2.302 2.302-10.937 6.333 8.635-8.635zm3.199-3.199l2.302 2.302-2.302 2.302-2.803-2.302 2.803-2.302zM5.864 2.658L16.8 8.99l-2.302 2.302-8.635-8.635z"/>
                    </svg>
                    {t.download_cta}
                  </Link>
                  {/* Google Play rating badge */}
                  <div className="flex items-center gap-1.5 text-default-500">
                    <div className="flex items-center gap-0.5" aria-label={t.download_rating_label}>
                      {[...Array(5)].map((_, i) => (
                        <svg key={i} xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="currentColor" className={i < 4 ? "text-warning" : "text-warning/40"} aria-hidden="true">
                          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                        </svg>
                      ))}
                    </div>
                    <span className="text-xs font-semibold">{t.download_rating}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </AnimatedSection>

        {/* ─── Testimonials / Reviews ─── */}
        <AnimatedSection id="reviews">
          <div className="text-center mb-8 sm:mb-10">
            <h2 className="text-2xl sm:text-3xl font-bold text-foreground">{t.reviews_title}</h2>
          </div>
          <div className="grid sm:grid-cols-3 gap-4 sm:gap-6">
            {[
              { text: t.review_1_text, author: t.review_1_author, detail: t.review_1_detail },
              { text: t.review_2_text, author: t.review_2_author, detail: t.review_2_detail },
              { text: t.review_3_text, author: t.review_3_author, detail: t.review_3_detail },
            ].map((review) => (
              <div key={review.author} className="glass-card rounded-2xl p-5 sm:p-6 flex flex-col gap-4">
                {/* Stars */}
                <div className="flex items-center gap-0.5">
                  {[...Array(5)].map((_, i) => (
                    <svg key={i} xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="currentColor" className="text-warning" aria-hidden="true">
                      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                    </svg>
                  ))}
                </div>
                {/* Quote */}
                <p className="text-sm text-default-600 dark:text-default-400 leading-relaxed flex-grow">
                  &ldquo;{review.text}&rdquo;
                </p>
                {/* Author */}
                <div className="flex items-center gap-3 pt-2 border-t border-default-200 dark:border-default-100">
                  <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary text-xs font-bold">
                    {review.author.charAt(0)}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">{review.author}</p>
                    <p className="text-xs text-default-400">{review.detail}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </AnimatedSection>

        {/* ─── FAQ Section ─── */}
        <AnimatedSection id="faq" className="max-w-3xl mx-auto w-full">
          <div className="text-center mb-8 sm:mb-10">
            <h2 className="text-2xl sm:text-3xl font-bold text-foreground">{t.faq_title}</h2>
          </div>

          <div className="flex flex-col gap-8">
            {/* General — What is LiD, Einbürgerungstest, difference */}
            <div>
              <div className="flex items-center gap-2 mb-4">
                <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary/10 text-primary">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><path d="M12 17h.01"/></svg>
                </div>
                <h3 className="text-base sm:text-lg font-bold text-foreground">{t.faq_section_general}</h3>
              </div>
              <Accordion variant="bordered" selectionMode="multiple" className="gap-2">
                {[
                  { q: t.faq_q1, a: t.faq_a1 },
                  { q: t.faq_q2, a: t.faq_a2 },
                  { q: t.faq_q3, a: t.faq_a3 },
                ].map((faq, i) => (
                  <AccordionItem
                    key={`general-${i}`}
                    aria-label={faq.q}
                    title={<span className="font-semibold text-sm sm:text-base">{faq.q}</span>}
                  >
                    <p className="text-sm sm:text-base text-default-500 pb-2 leading-relaxed">{faq.a}</p>
                  </AccordionItem>
                ))}
              </Accordion>
            </div>

            {/* About the Test */}
            <div>
              <div className="flex items-center gap-2 mb-4">
                <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-warning/10 text-warning">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"/></svg>
                </div>
                <h3 className="text-base sm:text-lg font-bold text-foreground">{t.faq_section_test}</h3>
              </div>
              <Accordion variant="bordered" selectionMode="multiple" className="gap-2">
                {[
                  { q: t.faq_q4, a: t.faq_a4 },
                  { q: t.faq_q5, a: t.faq_a5 },
                  { q: t.faq_q6, a: t.faq_a6 },
                  { q: t.faq_q7, a: t.faq_a7 },
                  { q: t.faq_q8, a: t.faq_a8 },
                  { q: t.faq_q9, a: t.faq_a9 },
                  { q: t.faq_q10, a: t.faq_a10 },
                  { q: t.faq_q11, a: t.faq_a11 },
                ].map((faq, i) => (
                  <AccordionItem
                    key={`test-${i}`}
                    aria-label={faq.q}
                    title={<span className="font-semibold text-sm sm:text-base">{faq.q}</span>}
                  >
                    <p className="text-sm sm:text-base text-default-500 pb-2 leading-relaxed">{faq.a}</p>
                  </AccordionItem>
                ))}
              </Accordion>
            </div>

            {/* About This Platform */}
            <div>
              <div className="flex items-center gap-2 mb-4">
                <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-success/10 text-success">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect width="20" height="14" x="2" y="3" rx="2"/><path d="m8 21 4-4 4 4"/><path d="M7 11h.01"/><path d="M11 11h.01"/></svg>
                </div>
                <h3 className="text-base sm:text-lg font-bold text-foreground">{t.faq_section_platform}</h3>
              </div>
              <Accordion variant="bordered" selectionMode="multiple" className="gap-2">
                {[
                  { q: t.faq_q12, a: t.faq_a12 },
                  { q: t.faq_q13, a: t.faq_a13 },
                  { q: t.faq_q14, a: t.faq_a14 },
                ].map((faq, i) => (
                  <AccordionItem
                    key={`platform-${i}`}
                    aria-label={faq.q}
                    title={<span className="font-semibold text-sm sm:text-base">{faq.q}</span>}
                  >
                    <p className="text-sm sm:text-base text-default-500 pb-2 leading-relaxed">{faq.a}</p>
                  </AccordionItem>
                ))}
              </Accordion>
            </div>

            {/* Results & Evaluation */}
            <div>
              <div className="flex items-center gap-2 mb-4">
                <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-secondary/10 text-secondary">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 22h14"/><path d="M5 2h14"/><path d="M17 22v-4.172a2 2 0 0 0-.586-1.414L12 12l-4.414 4.414A2 2 0 0 0 7 17.828V22"/><path d="M7 2v4.172a2 2 0 0 0 .586 1.414L12 12l4.414-4.414A2 2 0 0 0 17 6.172V2"/></svg>
                </div>
                <h3 className="text-base sm:text-lg font-bold text-foreground">{t.faq_section_results}</h3>
              </div>
              <Accordion variant="bordered" selectionMode="multiple" className="gap-2">
                {[
                  { q: t.faq_q15, a: t.faq_a15 },
                  { q: t.faq_q16, a: t.faq_a16 },
                  { q: t.faq_q17, a: t.faq_a17 },
                ].map((faq, i) => (
                  <AccordionItem
                    key={`results-${i}`}
                    aria-label={faq.q}
                    title={<span className="font-semibold text-sm sm:text-base">{faq.q}</span>}
                  >
                    <p className="text-sm sm:text-base text-default-500 pb-2 leading-relaxed">
                      {faq.a
                        .replace(/\{avgWait\}/g, String(avgWait))
                        .replace(/\{examDate\}/g, evalData.examDate)
                        .replace(/\{lastSync\}/g, evalData.lastSyncAt.split(" ")[0])
                        .replace(/\{historyCount\}/g, String(evalData.history.length))}
                    </p>
                  </AccordionItem>
                ))}
              </Accordion>
            </div>
          </div>
        </AnimatedSection>

        {/* ─── Explore by State (Interactive Map) ─── */}
        <AnimatedSection id="explore">
          <div className="relative text-center mb-8 sm:mb-10">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-primary/10 text-primary mb-4">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0"/><circle cx="12" cy="10" r="3"/></svg>
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold text-foreground">{t.map_section_title}</h2>
            <p className="text-sm sm:text-base text-default-500 mt-2 max-w-2xl mx-auto leading-relaxed">{t.map_section_subtitle}</p>
          </div>

          <ExploreByStateMap t={t} states={states} />
        </AnimatedSection>

        {/* ─── CTA Banner ─── */}
        <AnimatedSection className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-foreground to-foreground/80 p-8 sm:p-10 md:p-14 text-center">
          <div className="relative z-10 flex flex-col items-center gap-4">
            <h2 className="text-xl sm:text-2xl md:text-3xl font-bold text-background">{t.cta_banner_title}</h2>
            <p className="text-background/70 max-w-xl text-sm sm:text-base">{t.cta_banner_subtitle}</p>
            <div className="flex flex-col sm:flex-row gap-3 mt-2">
              <Button
                size="lg"
                className="font-semibold bg-background text-foreground w-full sm:w-auto sm:px-10"
                onPress={() => router.push("/prepare")}
              >
                {t.hero_cta_start}
              </Button>
              <Link
                isExternal
                href={siteConfig.links.playStore}
                className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl border-2 border-background/30 text-background font-semibold text-sm hover:bg-background/10 transition-colors"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path d="M3.609 1.814L13.792 12 3.61 22.186a.996.996 0 0 1-.61-.92V2.734a1 1 0 0 1 .609-.92zm10.89 10.893l2.302 2.302-10.937 6.333 8.635-8.635zm3.199-3.199l2.302 2.302-2.302 2.302-2.803-2.302 2.803-2.302zM5.864 2.658L16.8 8.99l-2.302 2.302-8.635-8.635z"/>
                </svg>
                Google Play
              </Link>
            </div>
          </div>
          {/* Decorative elements */}
          <div className="absolute top-0 right-0 w-48 sm:w-64 h-48 sm:h-64 bg-background/5 rounded-full -translate-y-1/2 translate-x-1/2 animate-float" aria-hidden="true" />
          <div className="absolute bottom-0 left-0 w-36 sm:w-48 h-36 sm:h-48 bg-background/5 rounded-full translate-y-1/2 -translate-x-1/2 animate-float-delayed" aria-hidden="true" />
          <div className="absolute top-1/2 left-1/4 w-20 h-20 bg-background/3 rounded-full animate-float-delayed" aria-hidden="true" />
          {/* Decorative cross SVG */}
          <svg className="absolute bottom-4 right-8 w-6 h-6 text-background/10 animate-float" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <path d="M12 5v14M5 12h14" />
          </svg>
          <svg className="absolute top-8 left-12 w-8 h-8 text-background/10 animate-float-delayed" viewBox="0 0 100 100" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <polygon points="50,5 61,35 95,35 68,57 79,91 50,70 21,91 32,57 5,35 39,35" />
          </svg>
        </AnimatedSection>
      </div>
    </>
  );
}
