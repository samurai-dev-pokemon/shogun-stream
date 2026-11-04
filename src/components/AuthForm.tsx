"use client";

import Link from "next/link";
import { useState } from "react";
import { Logo } from "./Logo";

// UI only: no authentication logic is wired to this form.
export default function AuthForm({ mode }: { mode: "login" | "signup" }) {
  const signup = mode === "signup";
  const [show, setShow] = useState(false);

  return (
    <div className="flex min-h-[70vh] items-center justify-center">
      <div className="glass glass-strong fade-up w-full max-w-md rounded-[2rem] p-8 sm:p-10">
        <div className="flex justify-center">
          <Logo size={30} />
        </div>
        <h1 className="mt-8 text-center text-2xl font-semibold tracking-tight text-white">
          {signup ? "Create your account" : "Welcome back"}
        </h1>
        <p className="mt-1.5 text-center text-sm text-white/45">
          {signup ? "Join Shogun Stream in a few seconds." : "Log in to continue watching."}
        </p>

        <div className="mt-8 grid grid-cols-2 gap-3">
          <button type="button" className="btn">
            <span className="text-sm font-semibold">G</span>
            Google
          </button>
          <button type="button" className="btn">
            <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current"><path d="M16.4 12.6c0-2.300 1.900-3.400 2-3.500-1.100-1.600-2.800-1.800-3.400-1.800-1.400-.1-2.800.9-3.500.9s-1.800-.8-3-.8c-1.500 0-3 .9-3.800 2.300-1.600 2.800-.4 7 1.200 9.300.8 1.100 1.700 2.400 2.900 2.300 1.200 0 1.600-.7 3-.7s1.800.7 3 .7 2-1.100 2.800-2.200c.9-1.300 1.200-2.500 1.300-2.600-.1 0-2.500-1-2.500-3.900zM14.100 5.800c.6-.8 1.100-1.900.9-3-.9 0-2.100.6-2.700 1.400-.6.700-1.100 1.800-1 2.900 1.100.1 2.200-.5 2.800-1.300z" /></svg>
            Apple
          </button>
        </div>

        <div className="my-6 flex items-center gap-3 text-[0.7rem] uppercase tracking-[0.2em] text-white/30">
          <span className="h-px flex-1 bg-white/10" />
          or
          <span className="h-px flex-1 bg-white/10" />
        </div>

        <form onSubmit={(e) => e.preventDefault()} className="space-y-4">
          {signup && (
            <Field label="Name">
              <input className="field" type="text" placeholder="Your name" autoComplete="name" />
            </Field>
          )}
          <Field label="Email">
            <input className="field" type="email" placeholder="you@example.com" autoComplete="email" />
          </Field>
          <Field
            label="Password"
            aside={
              !signup ? (
                <button type="button" className="text-xs text-white/45 hover:text-white">
                  Forgot?
                </button>
              ) : null
            }
          >
            <div className="relative">
              <input className="field pr-14" type={show ? "text" : "password"} placeholder="••••••••" autoComplete={signup ? "new-password" : "current-password"} />
              <button type="button" onClick={() => setShow((s) => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-white/45 hover:text-white">
                {show ? "Hide" : "Show"}
              </button>
            </div>
          </Field>
          {signup && (
            <Field label="Confirm password">
              <input className="field" type="password" placeholder="••••••••" autoComplete="new-password" />
            </Field>
          )}
          {signup && (
            <label className="flex items-start gap-2.5 text-xs text-white/50">
              <input type="checkbox" className="mt-0.5" />
              I agree to the Terms and Privacy Policy.
            </label>
          )}
          <button type="submit" className="btn btn-accent w-full py-3">
            {signup ? "Create account" : "Log in"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-white/45">
          {signup ? "Already have an account? " : "New to Shogun Stream? "}
          <Link href={signup ? "/login" : "/signup"} className="text-white underline decoration-white/30 underline-offset-4 hover:decoration-white">
            {signup ? "Log in" : "Sign up"}
          </Link>
        </p>
      </div>
    </div>
  );
}

function Field({ label, aside, children }: { label: string; aside?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between">
        <label className="text-xs text-white/55">{label}</label>
        {aside}
      </div>
      {children}
    </div>
  );
}
