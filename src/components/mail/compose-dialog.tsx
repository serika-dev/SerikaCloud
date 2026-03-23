"use client";

import { useState } from "react";
import { X, Send, Minus, Maximize2, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

interface ComposeDialogProps {
  mailboxAddress: string;
  aliases?: { id: string; address: string }[];
  replyTo: {
    fromAddress: string;
    fromName: string | null;
    subject: string;
    bodyText: string | null;
    bodyHtml: string | null;
    messageId: string | null;
    receivedAt?: string;
  } | null;
  onClose: () => void;
  onSent: () => void;
}

export function ComposeDialog({
  mailboxAddress,
  aliases = [],
  replyTo,
  onClose,
  onSent,
}: ComposeDialogProps) {
  const allAddresses = [mailboxAddress, ...aliases.map((a) => a.address)];
  const [fromAddress, setFromAddress] = useState(mailboxAddress);
  const [showFromPicker, setShowFromPicker] = useState(false);
  const [to, setTo] = useState(replyTo ? replyTo.fromAddress : "");
  const [cc, setCc] = useState("");
  const [subject, setSubject] = useState(
    replyTo ? `Re: ${replyTo.subject.replace(/^Re:\s*/i, "")}` : ""
  );
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const [showCc, setShowCc] = useState(false);

  const quotedText = replyTo?.bodyText
    ? replyTo.bodyText
        .split("\n")
        .map((line) => `> ${line}`)
        .join("\n")
    : "";

  const handleSend = async () => {
    if (!to.trim()) {
      toast.error("Please add at least one recipient");
      return;
    }

    setSending(true);
    try {
      const recipients = to.split(",").map((e) => e.trim()).filter(Boolean);
      const ccRecipients = cc.split(",").map((e) => e.trim()).filter(Boolean);

      const fullBodyText = replyTo
        ? `${body}\n\n------- Original Message -------\nFrom: ${replyTo.fromName || replyTo.fromAddress} <${replyTo.fromAddress}>\n${replyTo.receivedAt ? `Date: ${new Date(replyTo.receivedAt).toLocaleString()}\n` : ""}Subject: ${replyTo.subject}\n\n${replyTo.bodyText || ""}`
        : body;

      const escapeHtml = (s: string) =>
        s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

      const fullBodyHtml = replyTo
        ? `<div style="font-family:sans-serif;font-size:14px;line-height:1.6;color:#111;">
            <div style="white-space:pre-wrap;">${escapeHtml(body)}</div>
            <br/>
            <div style="border-left:3px solid #a855f7;margin-top:16px;padding:12px 16px;background:#f5f0ff;border-radius:4px;font-size:13px;color:#444;">
              <div style="font-weight:600;margin-bottom:6px;color:#7c3aed;">
                ${escapeHtml(replyTo.fromName || replyTo.fromAddress)} &lt;${escapeHtml(replyTo.fromAddress)}&gt;
                ${replyTo.receivedAt ? `<span style="font-weight:400;color:#888;margin-left:8px;">${new Date(replyTo.receivedAt).toLocaleString()}</span>` : ""}
              </div>
              ${replyTo.bodyHtml
                ? `<div style="white-space:normal;">${replyTo.bodyHtml}</div>`
                : `<div style="white-space:pre-wrap;">${escapeHtml(replyTo.bodyText || "")}</div>`
              }
            </div>
          </div>`
        : `<div style="font-family:sans-serif;font-size:14px;line-height:1.6;white-space:pre-wrap;color:#111;">${escapeHtml(body)}</div>`;

      const res = await fetch("/api/mail/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: recipients,
          cc: ccRecipients.length > 0 ? ccRecipients : undefined,
          subject,
          bodyText: fullBodyText,
          bodyHtml: fullBodyHtml,
          inReplyTo: replyTo?.messageId || undefined,
          fromAddress,
        }),
      });

      if (res.ok) {
        toast.success("Email sent");
        onSent();
      } else {
        const data = await res.json();
        toast.error(data.error || "Failed to send");
      }
    } catch {
      toast.error("Failed to send email");
    } finally {
      setSending(false);
    }
  };

  if (minimized) {
    return (
      <div className="fixed bottom-0 right-4 z-50 w-72 rounded-t-xl border border-b-0 border-zinc-200 dark:border-[#1a1a1a] bg-white dark:bg-[#111] shadow-xl">
        <div
          className="flex items-center justify-between px-4 py-2.5 cursor-pointer rounded-t-xl bg-purple-600 text-white"
          onClick={() => setMinimized(false)}
        >
          <span className="text-sm font-medium truncate">{subject || "New Message"}</span>
          <div className="flex items-center gap-1">
            <button onClick={(e) => { e.stopPropagation(); setMinimized(false); }}>
              <Maximize2 className="h-3.5 w-3.5" />
            </button>
            <button onClick={(e) => { e.stopPropagation(); onClose(); }}>
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="fixed bottom-0 right-4 z-50 w-full max-w-[560px] rounded-t-xl border border-b-0 border-zinc-200 dark:border-[#2a2a2a] bg-white dark:bg-[#111] shadow-2xl flex flex-col"
      style={{ maxHeight: "75vh" }}
    >
      {/* Title bar */}
      <div className="flex items-center justify-between px-4 py-2.5 rounded-t-xl bg-gradient-to-r from-purple-700 to-purple-500 text-white shrink-0">
        <span className="text-sm font-semibold tracking-tight">
          {replyTo ? `Re: ${replyTo.subject}` : "New Message"}
        </span>
        <div className="flex items-center gap-0.5">
          <button onClick={() => setMinimized(true)} className="p-1.5 hover:bg-white/20 rounded transition-colors">
            <Minus className="h-3.5 w-3.5" />
          </button>
          <button onClick={onClose} className="p-1.5 hover:bg-white/20 rounded transition-colors">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Headers */}
      <div className="border-b border-zinc-100 dark:border-[#222] shrink-0">
        {/* From */}
        <div className="flex items-center px-4 py-2 border-b border-zinc-100 dark:border-[#1e1e1e] relative">
          <span className="text-xs font-medium text-muted-foreground w-12 shrink-0">From</span>
          <button
            onClick={() => allAddresses.length > 1 && setShowFromPicker(!showFromPicker)}
            className="flex items-center gap-1.5 text-sm text-foreground hover:text-purple-500 transition-colors font-mono"
          >
            {fromAddress}
            {allAddresses.length > 1 && <ChevronDown className="h-3 w-3 text-muted-foreground" />}
          </button>
          {showFromPicker && allAddresses.length > 1 && (
            <div className="absolute top-full left-12 z-10 mt-1 w-64 rounded-lg border border-zinc-200 dark:border-[#2a2a2a] bg-white dark:bg-[#161616] shadow-xl overflow-hidden">
              {allAddresses.map((addr) => (
                <button
                  key={addr}
                  onClick={() => { setFromAddress(addr); setShowFromPicker(false); }}
                  className={`w-full text-left px-3 py-2.5 text-sm font-mono hover:bg-purple-50 dark:hover:bg-purple-500/10 transition-colors ${
                    addr === fromAddress ? "text-purple-600 dark:text-purple-400 bg-purple-50/50 dark:bg-purple-500/5" : "text-foreground"
                  }`}
                >
                  {addr}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* To */}
        <div className="flex items-center px-4 py-1.5 border-b border-zinc-100 dark:border-[#1e1e1e]">
          <span className="text-xs font-medium text-muted-foreground w-12 shrink-0">To</span>
          <Input
            value={to}
            onChange={(e) => setTo(e.target.value)}
            placeholder="recipients@example.com, ..."
            className="border-none h-7 text-sm px-0 shadow-none focus-visible:ring-0 placeholder:text-muted-foreground/50"
          />
          {!showCc && (
            <button onClick={() => setShowCc(true)} className="text-xs text-muted-foreground hover:text-purple-500 transition-colors shrink-0 px-1">
              Cc
            </button>
          )}
        </div>

        {/* Cc */}
        {showCc && (
          <div className="flex items-center px-4 py-1.5 border-b border-zinc-100 dark:border-[#1e1e1e]">
            <span className="text-xs font-medium text-muted-foreground w-12 shrink-0">Cc</span>
            <Input
              value={cc}
              onChange={(e) => setCc(e.target.value)}
              placeholder="cc@example.com"
              className="border-none h-7 text-sm px-0 shadow-none focus-visible:ring-0 placeholder:text-muted-foreground/50"
              autoFocus
            />
          </div>
        )}

        {/* Subject */}
        <div className="flex items-center px-4 py-1.5">
          <span className="text-xs font-medium text-muted-foreground w-12 shrink-0">Subject</span>
          <Input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Subject"
            className="border-none h-7 text-sm px-0 shadow-none focus-visible:ring-0 font-medium placeholder:text-muted-foreground/50"
          />
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-auto flex flex-col min-h-0">
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Write your message..."
          className="w-full flex-1 resize-none text-sm bg-transparent outline-none placeholder:text-muted-foreground/50 px-4 py-3 leading-relaxed min-h-[120px]"
          autoFocus
        />

        {/* Quoted reply block */}
        {replyTo && (
          <div className="mx-4 mb-3 rounded-lg border-l-4 border-purple-400 dark:border-purple-600 bg-purple-50/60 dark:bg-purple-500/5 overflow-hidden">
            <div className="px-3 py-2 bg-purple-100/60 dark:bg-purple-500/10 flex items-center gap-2 border-b border-purple-200/50 dark:border-purple-500/20">
              <span className="text-xs font-semibold text-purple-700 dark:text-purple-400">
                {replyTo.fromName || replyTo.fromAddress}
              </span>
              <span className="text-xs text-purple-500/70 dark:text-purple-400/60 font-mono">&lt;{replyTo.fromAddress}&gt;</span>
              {replyTo.receivedAt && (
                <span className="text-xs text-muted-foreground/60 ml-auto">
                  {new Date(replyTo.receivedAt).toLocaleString()}
                </span>
              )}
            </div>
            <div className="px-3 py-2 text-xs text-muted-foreground leading-relaxed max-h-32 overflow-auto whitespace-pre-wrap">
              {replyTo.bodyText
                ? replyTo.bodyText.slice(0, 800) + (replyTo.bodyText.length > 800 ? "…" : "")
                : "(No text content)"}
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between px-4 py-2.5 border-t border-zinc-100 dark:border-[#1e1e1e] shrink-0 bg-zinc-50/50 dark:bg-[#0f0f0f]/50">
        <Button
          onClick={handleSend}
          disabled={sending || !to.trim()}
          size="sm"
          className="gap-2 bg-purple-600 hover:bg-purple-700 text-white shadow-sm shadow-purple-500/20 px-5"
        >
          <Send className="h-3.5 w-3.5" />
          {sending ? "Sending..." : "Send"}
        </Button>
        <button
          onClick={onClose}
          className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-zinc-200 dark:hover:bg-zinc-800 rounded transition-colors"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
