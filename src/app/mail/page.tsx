"use client";

import { SessionProvider } from "next-auth/react";
import { MailClient } from "@/components/mail/mail-client";

export default function MailPage() {
  return (
    <SessionProvider>
      <MailClient />
    </SessionProvider>
  );
}
