import Link from "next/link";
import Image from "next/image";
import { GoogleLoginButton } from "./_components/google-login-button";
import { t } from "@/locales";

const tl = t.auth.login;

export default function LoginPage() {
  return (
    <div className="relative flex min-h-screen items-center justify-center px-4">
      {/* Background orbs */}
      <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute top-1/4 left-1/4 h-[300px] w-[300px] rounded-full bg-red-600/8 blur-[60px]" />
        <div className="absolute right-1/4 bottom-1/4 h-[250px] w-[250px] rounded-full bg-blue-500/8 blur-[60px]" />
      </div>

      <div className="nm-raised w-full max-w-sm overflow-hidden rounded-2xl">
        <div className="flex flex-col items-center px-6 pt-8 pb-4 text-center">
          <Link href="/" className="mb-5">
            <Image src="/logo.svg" alt="BriefTube" width={48} height={48} />
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
