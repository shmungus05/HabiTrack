/**
 * IntroPage: Mission Path Selection screen.
 * Fits entirely within a single viewport (100vh) without scrolling,
 * matching the StarBound / Habitat Trace operational design mockup.
 */

import { Radio, Rocket } from "lucide-react";
import React, { useState } from "react";

import {
  ASTRONAUT_LOCKED_COHORT_ID,
  useRoleStore,
  type UserRole,
} from "../stores/roleStore";
import { useCohortStore } from "../stores/cohortStore";

interface IntroPageProps {
  onSelectRole?: (role: UserRole) => void;
}

export function IntroPage({ onSelectRole }: IntroPageProps) {
  const selectRoleAndEnter = useRoleStore((state) => state.selectRoleAndEnter);
  const selectAstronaut = useCohortStore((state) => state.selectAstronaut);
  const [showContactModal, setShowContactModal] = useState(false);

  const handleSelectRole = (role: UserRole) => {
    if (role === "astronaut") {
      selectAstronaut(ASTRONAUT_LOCKED_COHORT_ID);
    }
    selectRoleAndEnter(role);
    if (onSelectRole) {
      onSelectRole(role);
    }
  };

  return (
    <div className="relative h-screen max-h-screen w-full flex flex-col justify-between bg-[#f8fafc] text-slate-800 font-sans selection:bg-blue-100 overflow-hidden px-4 py-4 sm:py-6">
      {/* Subtle ambient light glows */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-24 left-1/2 -translate-x-1/2 h-80 w-[600px] rounded-full bg-blue-100/40 blur-3xl" />
        <div className="absolute top-1/2 -left-20 h-60 w-60 rounded-full bg-sky-100/30 blur-3xl" />
        <div className="absolute bottom-4 -right-20 h-60 w-60 rounded-full bg-indigo-100/30 blur-3xl" />
      </div>

      {/* Top Header: Brand Pill + Heading */}
      <header className="relative z-10 mx-auto flex flex-col items-center text-center shrink-0">
        {/* Brand Pill matching mockup */}
        <div className="inline-flex items-center gap-1.5 rounded-full border border-blue-200/80 bg-white px-3 py-1 text-xs font-semibold text-blue-700 shadow-2xs">
          <span className="grid h-4 w-4 place-items-center rounded-full bg-[#2563eb] text-white">
            <Rocket className="h-2.5 w-2.5" />
          </span>
          <span className="font-bold tracking-tight text-[11px] sm:text-xs">
            StarBound · Habitat Trace
          </span>
        </div>

        {/* Title & Subtitle */}
        <h1 className="mt-2.5 text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900">
          Select Your Mission Path
        </h1>
        <p className="mt-1 max-w-md text-xs sm:text-sm text-slate-500 leading-normal px-2">
          Choose your specialization to begin your journey into the final frontier.
        </p>
      </header>

      {/* Middle Content: 2 Cards side-by-side matching mockup */}
      <main className="relative z-10 mx-auto flex w-full max-w-3xl lg:max-w-4xl flex-1 items-center justify-center my-auto py-2">
        <div className="grid w-full grid-cols-1 sm:grid-cols-2 gap-5 sm:gap-7">
          {/* Card 1: Astronaut / Field Mission */}
          <div className="group relative flex flex-col justify-between rounded-3xl border border-slate-200/90 bg-white p-5 sm:p-6 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-xl">
            <div className="flex flex-col items-center text-center">
              {/* Photo */}
              <div className="relative aspect-[16/10.5] sm:h-44 md:h-48 w-full overflow-hidden rounded-2xl border border-slate-100 bg-slate-100 shadow-inner">
                <img
                  src="/imagery/astronaut-mission.jpg"
                  alt="Astronaut Field Mission"
                  className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = "/avatars/astro-01.jpg";
                  }}
                />
              </div>

              {/* Tag / Badge */}
              <div className="mt-4">
                <span className="inline-block rounded-full bg-[#e0f2fe] px-3.5 py-1 text-[11px] font-bold uppercase tracking-wider text-[#0284c7]">
                  Field Mission
                </span>
              </div>

              {/* Title & Description */}
              <h2 className="mt-2.5 text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
                Astronaut
              </h2>
              <p className="mt-1.5 text-xs sm:text-sm text-slate-500 leading-snug px-2 min-h-[36px] flex items-center justify-center">
                Train for orbital operations, extravehicular activities, and planetary exploration.
              </p>
            </div>

            {/* Action Button */}
            <div className="mt-5 pt-1">
              <button
                type="button"
                onClick={() => handleSelectRole("astronaut")}
                className="inline-flex w-full items-center justify-center rounded-xl bg-[#2563eb] hover:bg-blue-700 text-white font-semibold text-xs sm:text-sm py-2.5 sm:py-3 px-5 shadow-xs transition-all duration-200 cursor-pointer active:scale-[0.99]"
              >
                Initialize Mission
              </button>
            </div>
          </div>

          {/* Card 2: Flight Surgeon / Medical Ops */}
          <div className="group relative flex flex-col justify-between rounded-3xl border border-slate-200/90 bg-white p-5 sm:p-6 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:border-emerald-300 hover:shadow-xl">
            <div className="flex flex-col items-center text-center">
              {/* Photo */}
              <div className="relative aspect-[16/10.5] sm:h-44 md:h-48 w-full overflow-hidden rounded-2xl border border-slate-100 bg-slate-100 shadow-inner">
                <img
                  src="/imagery/flight-surgeon.jpg"
                  alt="Flight Surgeon Medical Operations"
                  className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = "/avatars/astro-02.jpg";
                  }}
                />
              </div>

              {/* Tag / Badge */}
              <div className="mt-4">
                <span className="inline-block rounded-full bg-[#dcfce7] px-3.5 py-1 text-[11px] font-bold uppercase tracking-wider text-[#16a34a]">
                  Medical Ops
                </span>
              </div>

              {/* Title & Description */}
              <h2 className="mt-2.5 text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
                Flight Surgeon
              </h2>
              <p className="mt-1.5 text-xs sm:text-sm text-slate-500 leading-snug px-2 min-h-[36px] flex items-center justify-center">
                Manage crew health, monitor physiological data, and direct aerospace medical support.
              </p>
            </div>

            {/* Action Button */}
            <div className="mt-5 pt-1">
              <button
                type="button"
                onClick={() => handleSelectRole("flight_surgeon")}
                className="inline-flex w-full items-center justify-center rounded-xl bg-[#2563eb] hover:bg-blue-700 text-white font-semibold text-xs sm:text-sm py-2.5 sm:py-3 px-5 shadow-xs transition-all duration-200 cursor-pointer active:scale-[0.99]"
              >
                Enter Command Center
              </button>
            </div>
          </div>
        </div>
      </main>

      {/* Footer matching mockup */}
      <footer className="relative z-10 shrink-0 text-center py-1 sm:py-2">
        <p className="text-[11px] text-slate-400">
          <span>System v2.4.0</span>
          <span className="mx-2 text-slate-300">•</span>
          <span>Need help with your selection?</span>
          {" "}
          <button
            type="button"
            onClick={() => setShowContactModal(true)}
            className="font-medium text-blue-600 hover:text-blue-800 hover:underline cursor-pointer"
          >
            Contact Mission Control
          </button>
        </p>
      </footer>

      {/* Mission Control Modal */}
      {showContactModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-2xs animate-in fade-in duration-200">
          <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl">
            <div className="flex items-center gap-2.5">
              <span className="grid h-9 w-9 place-items-center rounded-xl bg-blue-50 text-blue-600">
                <Radio className="h-4 w-4" />
              </span>
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Mission Control Guidance
                </h3>
                <p className="text-[11px] text-slate-500">
                  ISS Flight Operations Directorate
                </p>
              </div>
            </div>

            <div className="mt-3.5 space-y-2 text-xs text-slate-600 leading-relaxed">
              <p>
                <strong className="text-slate-800">Field Mission (Astronaut):</strong> For onboard crew members checking individual circadian vitals, personal biometrics, and rapid symptom logging.
              </p>
              <p>
                <strong className="text-slate-800">Medical Ops (Flight Surgeon):</strong> For ground and clinical support monitoring fleet-wide telemetry, 4-lane timelines, and clinical risk matrices.
              </p>
            </div>

            <div className="mt-4 flex justify-end">
              <button
                type="button"
                onClick={() => setShowContactModal(false)}
                className="rounded-lg bg-slate-900 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-slate-800 cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
