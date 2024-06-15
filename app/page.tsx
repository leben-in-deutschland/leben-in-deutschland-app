"use client";
import StateSelect from "@/components/state-select";
import Image from "next/image";

export default function Home() {
  return (
    <section className="flex flex-col items-center justify-center gap-4 py-8 md:py-10">
      <StateSelect />
    </section >
  );
}
