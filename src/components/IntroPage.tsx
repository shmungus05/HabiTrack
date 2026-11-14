/**
 * IntroPage: Mission Path Selection screen.
 * Allows operators to select between Field Mission (Astronaut) and Medical Ops (Flight Surgeon),
 * strictly partitioning role-specific functions.
 */

import {
  Activity,
  ArrowRight,
  CheckCircle2,
  FileText,
  HeartPulse,
  Radio,
  Rocket,
  ShieldAlert,
  Stethoscope,
  Users,
} from "lucide-react";
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
    <div className="relative min-h-screen w-full flex flex-col justify-between bg-[#f8fafc] text-slate-800 font-sans selection:bg-blue-100 overflow-x-hidden">
      {/* Subtle background ambient flare */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-32 left-1/2 -translate-x-1/2 h-96 w-[700px] rounded-full bg-blue-100/50 blur-3xl" />
        <div className="absolute top-1/3 -left-20 h-72 w-72 rounded-full bg-sky-100/40 blur-3xl" />
        <div className="absolute bottom-10 -right-20 h-72 w-72 rounded-full bg-indigo-100/30 blur-3xl" />
      </div>

      {/* Main Content Area */}
      <main className="relative z-10 mx-auto flex w-full max-w-5xl flex-1 flex-col items-center justify-center px-4 py-12 sm:px-6 sm:py-16">
        {/* Brand Pill */}
        <div className="inline-flex items-center gap-2 rounded-full border border-blue-200/80 bg-white px-3.5 py-1.5 text-xs font-semibold text-blue-700 shadow-xs">
          <span className="grid h-5 w-5 place-items-center rounded-full bg-blue-600 text-white shadow-xs">
            <Rocket className="h-3 w-3" />
          </span>
          <span className="tracking-tight font-bold">StarBound · Habitat Trace</span>
        </div>

        {/* Heading & Subtitle */}
        <div className="mt-4 text-center">
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-slate-900">
            Select Your Mission Path
          </h1>
          <p className="mt-3 max-w-lg text-sm sm:text-base text-slate-500 leading-relaxed mx-auto">
            Choose your specialization to begin your journey into the final frontier.
          </p>
        </div>

        {/* 2-Card Mission Selection Grid */}
        <div className="mt-10 grid w-full grid-cols-1 gap-6 sm:gap-8 md:grid-cols-2 max-w-4xl">
          {/* Card 1: Astronaut / Field Mission */}
          <div className="group relative flex flex-col justify-between rounded-3xl border border-slate-200/90 bg-white p-6 sm:p-7 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-blue-300 hover:shadow-xl">
            <div>
              {/* Photo Viewport */}
              <div className="relative aspect-[16/11] w-full overflow-hidden rounded-2xl border border-slate-100 bg-slate-100 shadow-inner">
                <img
                  src="/imagery/astronaut-mission.jpg"
                  alt="Astronaut Field Mission"
                  className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                  onError={(e) => {
                    // Graceful fallback to avatar if cropped image is unavailable
                    (e.target as HTMLImageElement).src = "/avatars/astro-01.jpg";
                  }}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-transparent" />
              </div>

              {/* Tag / Badge */}
              <div className="mt-5 flex justify-center">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-sky-100 bg-sky-50 px-3.5 py-1 text-[11px] font-bold uppercase tracking-wider text-sky-700">
                  <span className="h-1.5 w-1.5 rounded-full bg-sky-500" />
                  Field Mission
                </span>
              </div>

              {/* Title & Description */}
              <div className="mt-3 text-center">
                <h2 className="text-2xl font-bold tracking-tight text-slate-900">
                  Astronaut
                </h2>
                <p className="mt-2 text-xs sm:text-sm text-slate-500 leading-relaxed px-2">
                  Train for orbital operations, extravehicular activities, and planetary exploration.
                </p>
              </div>

              {/* Functional Highlights */}
              <div className="mt-5 rounded-xl border border-slate-100 bg-slate-50/70 p-3.5 space-y-2 text-left">
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-600">
                  Onboard Capabilities:
                </p>
                <ul className="space-y-1.5 text-xs text-slate-600">
                  <li className="flex items-center gap-2">
                    <HeartPulse className="h-3.5 w-3.5 text-sky-600 shrink-0" />
                    <span>Personal biometrics &amp; circadian vitals</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Stethoscope className="h-3.5 w-3.5 text-sky-600 shrink-0" />
                    <span>Rapid symptom journal &amp; AI Standby chatbot</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <ShieldAlert className="h-3.5 w-3.5 text-sky-600 shrink-0" />
                    <span>Glanceable cabin environmental alerts</span>
                  </li>
                </ul>
              </div>
            </div>

            {/* Action Button */}
            <div className="mt-6">
              <button
                type="button"
                onClick={() => handleSelectRole("astronaut")}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition-all duration-200 hover:bg-blue-700 hover:shadow-md cursor-pointer active:scale-[0.99]"
              >
                <span>Initialize Mission</span>
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Card 2: Flight Surgeon / Medical Ops */}
          <div className="group relative flex flex-col justify-between rounded-3xl border border-slate-200/90 bg-white p-6 sm:p-7 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-emerald-300 hover:shadow-xl">
            <div>
              {/* Photo Viewport */}
              <div className="relative aspect-[16/11] w-full overflow-hidden rounded-2xl border border-slate-100 bg-slate-100 shadow-inner">
                <img
                  src="/imagery/flight-surgeon.jpg"
                  alt="Flight Surgeon Medical Operations"
                  className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                  onError={(e) => {
                    // Graceful fallback to avatar if cropped image is unavailable
                    (e.target as HTMLImageElement).src = "/avatars/astro-02.jpg";
                  }}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-transparent" />
              </div>

              {/* Tag / Badge */}
              <div className="mt-5 flex justify-center">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-100 bg-emerald-50 px-3.5 py-1 text-[11px] font-bold uppercase tracking-wider text-emerald-700">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  Medical Ops
                </span>
              </div>

              {/* Title & Description */}
              <div className="mt-3 text-center">
                <h2 className="text-2xl font-bold tracking-tight text-slate-900">
                  Flight Surgeon
                </h2>
                <p className="mt-2 text-xs sm:text-sm text-slate-500 leading-relaxed px-2">
                  Manage crew health, monitor physiological data, and direct aerospace medical support.
                </p>
              </div>

              {/* Functional Highlights */}
              <div className="mt-5 rounded-xl border border-slate-100 bg-slate-50/70 p-3.5 space-y-2 text-left">
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-600">
                  Command Center Capabilities:
                </p>
                <ul className="space-y-1.5 text-xs text-slate-600">
                  <li className="flex items-center gap-2">
                    <Users className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                    <span>Full expedition multi-crew cohort oversight</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Activity className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                    <span>Synchronized 4-lane WebGL timeline &amp; delays</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <FileText className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                    <span>Clinical risk matrix &amp; flight rule verification</span>
                  </li>
                </ul>
              </div>
            </div>

            {/* Action Button */}
            <div className="mt-6">
              <button
                type="button"
                onClick={() => handleSelectRole("flight_surgeon")}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition-all duration-200 hover:bg-blue-700 hover:shadow-md cursor-pointer active:scale-[0.99]"
              >
                <span>Enter Command Center</span>
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </main>

      {/* Footer info matching reference mockup */}
      <footer className="relative z-10 w-full border-t border-slate-200/80 bg-white/70 py-4 text-center backdrop-blur-xs">
        <p className="text-xs text-slate-500">
          <span>System v3.0.0</span>
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl">
            <div className="flex items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-blue-50 text-blue-600">
                <Radio className="h-5 w-5" />
              </span>
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Mission Control Comms
                </h3>
                <p className="text-xs text-slate-500">
                  ISS Flight Operations Directorate · Houston / Tsukuba / Munich
                </p>
              </div>
            </div>

            <div className="mt-4 space-y-2.5 text-xs text-slate-600">
              <p>
                <strong>Field Mission (Astronaut):</strong> Tailored for onboard crew members performing operational checklists, monitoring their individual circadian adaptation, and reporting subjective symptoms.
              </p>
              <p>
                <strong>Medical Ops (Flight Surgeon):</strong> Dedicated ground and telemedicine station equipped with cohort-wide clinical triage, multi-stream timeline concordance, and diagnostic flight rules.
              </p>
            </div>

            <div className="mt-6 flex justify-end">
              <button
                type="button"
                onClick={() => setShowContactModal(false)}
                className="rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800 cursor-pointer"
              >
                Close Comms
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
