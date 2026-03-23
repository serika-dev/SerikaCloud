"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { Loader2, Eye, EyeOff, Check, X, User, Mail, Lock, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export default function RegisterPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const passwordChecks = [
    { label: "At least 8 characters", valid: password.length >= 8 },
    { label: "Contains a number", valid: /\d/.test(password) },
    { label: "Contains uppercase", valid: /[A-Z]/.test(password) },
    { label: "Passwords match", valid: password === confirmPassword && confirmPassword.length > 0 },
  ];

  const allValid = passwordChecks.every((c) => c.valid) && name.length >= 2 && email.includes("@");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!allValid) return;

    setLoading(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error || "Registration failed");
        return;
      }

      toast.success("Account created! Check your email for verification.");
      router.push("/login");
    } catch {
      toast.error("An unexpected error occurred");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#050505] text-white overflow-hidden selection:bg-[#8b5cf6] selection:text-white">
      <div className="fixed inset-0 pointer-events-none z-0">
        <div
          className="absolute top-0 left-0 w-[45%] h-full bg-[#8b5cf6]/[0.03] origin-top-left"
          style={{ transform: "skewX(6deg)" }}
        />
        <div className="absolute top-[20%] right-[5%] w-[2px] h-[25vh] bg-[#8b5cf6]/15" />
      </div>

      <header className="fixed top-0 left-0 right-0 z-50 p-5 lg:p-8">
        <Link href="/" className="group inline-block">
          <Image
            src="/Logo.svg"
            alt="SerikaCloud"
            width={160}
            height={45}
            className="h-9 lg:h-10 w-auto transition-all duration-300 group-hover:drop-shadow-[0_0_15px_rgba(139,92,246,0.5)]"
            priority
          />
        </Link>
      </header>

      <main className="relative z-10 min-h-screen flex">
        <div className="hidden lg:flex w-[48%] items-center justify-center p-12 relative bg-[#0a0a0a]">
          <div className="max-w-md relative z-10">
            <h1 className="text-5xl xl:text-6xl font-black uppercase tracking-tighter leading-[0.9] mb-6">
              <span className="block text-white">Join</span>
              <span className="block text-[#8b5cf6]">SerikaCloud</span>
            </h1>
            <div className="w-16 h-1 bg-[#8b5cf6] mb-6" style={{ transform: "skewX(-20deg)" }} />
            <p className="text-base text-white/40 font-medium">
              Create an account and get 1GB of free secure cloud storage.
            </p>
          </div>
          <div
            className="absolute right-0 top-0 h-full w-[80px] bg-[#050505] origin-top-right"
            style={{ transform: "skewX(-6deg)", marginRight: "-40px" }}
          />
          <div
            className="absolute right-[-2px] top-0 h-full w-[3px] bg-[#8b5cf6] origin-top-right z-10"
            style={{ transform: "skewX(-6deg)" }}
          />
        </div>

        <div className="flex-1 flex items-center justify-center p-6 lg:p-12">
          <div className="w-full max-w-md">
            <div className="relative bg-[#0a0a0a] border border-[#1a1a1a] p-6 lg:p-10 lg:[transform:skewX(-2deg)] shadow-2xl">
              <div className="hidden lg:block absolute top-0 left-0 w-1 h-full bg-[#8b5cf6]" />
              <div className="hidden lg:block absolute top-0 left-0 w-12 h-1 bg-[#8b5cf6]" />

              <div className="lg:[transform:skewX(2deg)]">
                <div className="lg:hidden text-center mb-6">
                  <h1 className="text-2xl font-black uppercase tracking-tighter">
                    <span className="text-white">Join </span>
                    <span className="text-[#8b5cf6]">SerikaCloud</span>
                  </h1>
                </div>

                <form onSubmit={handleSubmit} className="space-y-5">
                  <div className="space-y-1.5">
                    <Label className="text-[10px] uppercase font-black tracking-[0.15em] text-white/40 pl-1">
                      Name
                    </Label>
                    <div className="relative group">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/20 group-focus-within:text-[#8b5cf6] transition-colors" />
                      <Input
                        id="name"
                        type="text"
                        placeholder="Your name"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="pl-10 h-12 bg-[#111] border-[#222] focus-visible:border-[#8b5cf6] focus-visible:ring-1 focus-visible:ring-[#8b5cf6] placeholder:text-white/15 font-medium rounded-none transition-all"
                        required
                        autoFocus
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-[10px] uppercase font-black tracking-[0.15em] text-white/40 pl-1">
                      Email
                    </Label>
                    <div className="relative group">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/20 group-focus-within:text-[#8b5cf6] transition-colors" />
                      <Input
                        id="email"
                        type="email"
                        placeholder="you@example.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="pl-10 h-12 bg-[#111] border-[#222] focus-visible:border-[#8b5cf6] focus-visible:ring-1 focus-visible:ring-[#8b5cf6] placeholder:text-white/15 font-medium rounded-none transition-all"
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-[10px] uppercase font-black tracking-[0.15em] text-white/40 pl-1">
                      Password
                    </Label>
                    <div className="relative group">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/20 group-focus-within:text-[#8b5cf6] transition-colors" />
                      <Input
                        id="password"
                        type={showPassword ? "text" : "password"}
                        placeholder="••••••••"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="pl-10 pr-10 h-12 bg-[#111] border-[#222] focus-visible:border-[#8b5cf6] focus-visible:ring-1 focus-visible:ring-[#8b5cf6] placeholder:text-white/15 font-medium rounded-none transition-all"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-white/20 hover:text-white/50 transition-colors"
                        tabIndex={-1}
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-[10px] uppercase font-black tracking-[0.15em] text-white/40 pl-1">
                      Confirm Password
                    </Label>
                    <div className="relative group">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/20 group-focus-within:text-[#8b5cf6] transition-colors" />
                      <Input
                        id="confirm-password"
                        type={showPassword ? "text" : "password"}
                        placeholder="••••••••"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className="pl-10 pr-10 h-12 bg-[#111] border-[#222] focus-visible:border-[#8b5cf6] focus-visible:ring-1 focus-visible:ring-[#8b5cf6] placeholder:text-white/15 font-medium rounded-none transition-all"
                        required
                      />
                    </div>
                  </div>

                  {/* Password requirements */}
                  {password.length > 0 && (
                    <div className="space-y-2 !mt-4 bg-[#111] border border-[#222] p-4 text-xs">
                      <p className="text-[#8b5cf6] font-black uppercase tracking-[0.1em] mb-2">Password Requirements</p>
                      {passwordChecks.map((check) => (
                        <div key={check.label} className="flex items-center gap-2">
                          {check.valid ? (
                            <Check className="h-3 w-3 text-[#8b5cf6]" />
                          ) : (
                            <X className="h-3 w-3 text-white/30" />
                          )}
                          <span className={check.valid ? "text-white/80 font-medium" : "text-white/30"}>
                            {check.label}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}

                  <Button
                    type="submit"
                    className="w-full h-12 bg-[#8b5cf6] hover:bg-[#7c3aed] text-white font-black tracking-widest uppercase rounded-none transition-all hover:translate-y-[-2px] hover:shadow-[0_8px_20px_-8px_rgba(139,92,246,0.5)] active:translate-y-0 mt-6"
                    disabled={loading || !allValid}
                  >
                    {loading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Creating Account...
                      </>
                    ) : (
                      <>
                        Create Account <ArrowRight className="ml-2 h-4 w-4" />
                      </>
                    )}
                  </Button>
                </form>

                <div className="mt-6 text-center text-xs font-bold tracking-wide text-white/40">
                  ALREADY HAVE AN ACCOUNT?{" "}
                  <Link
                    href="/login"
                    className="text-[#8b5cf6] hover:text-[#c4b5fd] transition-colors"
                  >
                    SIGN IN
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
