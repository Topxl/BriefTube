"use client";

import Link from "next/link";
import { GoogleLoginButton } from "./_components/google-login-button";
import { t } from "@/locales";

const tl = t.auth.login;

export default function LoginPage() {
  return (
    <div className="relative flex min-h-screen items-center justify-center px-4">
      {/* Background orbs */}
      <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div
          className="absolute top-1/4 left-1/4 h-[300px] w-[300px] rounded-full bg-red-600/8 blur-[150px]"
          style={{ animation: "orb-drift 20s ease-in-out infinite" }}
        />
        <div
          className="absolute right-1/4 bottom-1/4 h-[250px] w-[250px] rounded-full bg-blue-500/8 blur-[150px]"
          style={{ animation: "orb-drift 25s ease-in-out infinite reverse" }}
        />
      </div>

      <div className="nm-raised w-full max-w-sm overflow-hidden rounded-2xl">
        <div className="flex flex-col items-center px-6 pt-8 pb-4 text-center">
          <Link
            href="/"
            className="nm-raised mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-red-600 shadow-[0_0_20px_rgba(239,68,68,0.3)]"
          >
            <svg
              width="24"
              height="24"
              viewBox="0 0 32 32"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <g transform="translate(0, 2)">
                <path d="M0 0L10 9L0 18V0Z" fill="white" />
                <path d="M13 0L23 9L13 18V0Z" fill="white" opacity="0.85" />
              </g>
            </svg>
          </Link>
          <p className="text-lg font-semibold">{tl.heading}</p>
          <p className="text-muted-foreground mt-1 text-sm">{tl.subtitle}</p>
        </div>
        <div className="space-y-4 px-6 pb-6">
          <GoogleLoginButton />
          <p className="text-muted-foreground text-center text-xs">
            {tl.terms}
          </p>
        </div>
      </div>
    </div>
  );
}
