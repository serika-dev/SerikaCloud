"use client";

import { useEffect, useState, useCallback } from "react";
import {
  ChevronLeft, Plus, Loader2, AlertTriangle, Clock, CheckCircle2,
  CircleDot, Search, User, Send, MessageSquare, Tag,
  ArrowUpCircle, ArrowDownCircle, MinusCircle, XCircle,
  Filter,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

interface TicketUser {
  id: string;
  name: string;
  email: string;
}

interface TicketMessage {
  id: string;
  content: string;
  isInternal: boolean;
  createdAt: string;
  author: TicketUser;
}

interface Ticket {
  id: string;
  number: number;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  creator: TicketUser;
  assignee: TicketUser | null;
  tags: string[] | null;
  dueDate: string | null;
  createdAt: string;
  updatedAt: string;
  resolvedAt: string | null;
  closedAt: string | null;
  messages?: TicketMessage[];
  _count?: { messages: number };
}

interface OrgMember {
  id: string;
  userId: string;
  role: string;
  user: { id: string; name: string; email: string };
}

interface TicketPanelProps {
  orgId: string;
  members: OrgMember[];
  onBack: () => void;
}

const STATUS_CONFIG: Record<string, { icon: React.ElementType; color: string; bg: string }> = {
  OPEN: { icon: CircleDot, color: "text-blue-500", bg: "bg-blue-100 dark:bg-blue-900/30" },
  IN_PROGRESS: { icon: Clock, color: "text-amber-500", bg: "bg-amber-100 dark:bg-amber-900/30" },
  WAITING: { icon: Clock, color: "text-orange-500", bg: "bg-orange-100 dark:bg-orange-900/30" },
  RESOLVED: { icon: CheckCircle2, color: "text-emerald-500", bg: "bg-emerald-100 dark:bg-emerald-900/30" },
  CLOSED: { icon: XCircle, color: "text-zinc-400", bg: "bg-zinc-100 dark:bg-zinc-800" },
};

const PRIORITY_CONFIG: Record<string, { icon: React.ElementType; color: string; label: string }> = {
  URGENT: { icon: ArrowUpCircle, color: "text-red-500", label: "Urgent" },
  HIGH: { icon: ArrowUpCircle, color: "text-orange-500", label: "High" },
  MEDIUM: { icon: MinusCircle, color: "text-blue-500", label: "Medium" },
  LOW: { icon: ArrowDownCircle, color: "text-zinc-400", label: "Low" },
};

export function TicketPanel({ orgId, members, onBack }: TicketPanelProps) {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [stats, setStats] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [creating, setCreating] = useState(false);
  const [filter, setFilter] = useState<string>("all");
  const [search, setSearch] = useState("");

  // Create form
  const [newTitle, setNewTitle] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newPriority, setNewPriority] = useState("MEDIUM");
  const [newAssignee, setNewAssignee] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Message form
  const [newMessage, setNewMessage] = useState("");
  const [isInternal, setIsInternal] = useState(false);
  const [sendingMsg, setSendingMsg] = useState(false);

  const fetchTickets = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filter !== "all") params.set("status", filter);
      if (search) params.set("search", search);
      params.set("limit", "50");

      const res = await fetch(`/api/org/${orgId}/tickets?${params}`);
      if (res.ok) {
        const data = await res.json();
        setTickets(data.tickets || []);
        setStats(data.stats || {});
      }
    } finally { setLoading(false); }
  }, [orgId, filter, search]);

  useEffect(() => { fetchTickets(); }, [fetchTickets]);

  const fetchTicketDetail = async (ticketId: string) => {
    const res = await fetch(`/api/org/${orgId}/tickets/${ticketId}`);
    if (res.ok) {
      const data = await res.json();
      setSelectedTicket(data.ticket);
    }
  };

  const createTicket = async () => {
    if (!newTitle.trim()) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/org/${orgId}/tickets`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: newTitle.trim(),
          description: newDesc.trim() || null,
          priority: newPriority,
          assigneeId: newAssignee || null,
        }),
      });
      if (res.ok) {
        setNewTitle(""); setNewDesc(""); setNewPriority("MEDIUM"); setNewAssignee("");
        setCreating(false);
        toast.success("Ticket created!");
        fetchTickets();
      } else {
        const data = await res.json();
        toast.error(data.error || "Failed to create");
      }
    } finally { setSubmitting(false); }
  };

  const updateTicket = async (ticketId: string, data: any) => {
    const res = await fetch(`/api/org/${orgId}/tickets`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ticketId, ...data }),
    });
    if (res.ok) {
      const updated = await res.json();
      setTickets((prev) => prev.map((t) => t.id === ticketId ? updated.ticket : t));
      if (selectedTicket?.id === ticketId) {
        setSelectedTicket((prev) => prev ? { ...prev, ...updated.ticket } : null);
      }
      toast.success("Updated");
    }
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || !selectedTicket) return;
    setSendingMsg(true);
    try {
      const res = await fetch(`/api/org/${orgId}/tickets/${selectedTicket.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: newMessage.trim(), isInternal }),
      });
      if (res.ok) {
        setNewMessage("");
        fetchTicketDetail(selectedTicket.id);
        toast.success(isInternal ? "Internal note added" : "Reply sent");
      }
    } finally { setSendingMsg(false); }
  };

  const totalOpen = (stats.OPEN || 0) + (stats.IN_PROGRESS || 0) + (stats.WAITING || 0);

  // Ticket Detail View
  if (selectedTicket) {
    const statusConf = STATUS_CONFIG[selectedTicket.status] || STATUS_CONFIG.OPEN;
    const StatusIcon = statusConf.icon;
    const priorityConf = PRIORITY_CONFIG[selectedTicket.priority] || PRIORITY_CONFIG.MEDIUM;
    const PriorityIcon = priorityConf.icon;

    return (
      <div className="flex-1 flex flex-col min-w-0">
        <div className="flex items-center gap-3 px-6 py-3 border-b border-zinc-200 dark:border-[#1a1a1a]">
          <Button variant="ghost" size="icon-sm" onClick={() => setSelectedTicket(null)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono text-muted-foreground">#{selectedTicket.number}</span>
              <StatusIcon className={`h-3.5 w-3.5 ${statusConf.color}`} />
              <PriorityIcon className={`h-3.5 w-3.5 ${priorityConf.color}`} />
            </div>
            <h2 className="text-sm font-bold truncate">{selectedTicket.title}</h2>
          </div>
        </div>

        {/* Ticket info bar */}
        <div className="flex items-center gap-3 px-6 py-2.5 border-b border-zinc-100 dark:border-[#111] bg-zinc-50/50 dark:bg-[#0a0a0a]/50 overflow-x-auto">
          <select
            value={selectedTicket.status}
            onChange={(e) => updateTicket(selectedTicket.id, { status: e.target.value })}
            className="h-7 rounded-md border border-zinc-200 dark:border-[#1a1a1a] bg-white dark:bg-[#111] text-xs px-2"
          >
            {Object.keys(STATUS_CONFIG).map((s) => <option key={s} value={s}>{s.replace("_", " ")}</option>)}
          </select>
          <select
            value={selectedTicket.priority}
            onChange={(e) => updateTicket(selectedTicket.id, { priority: e.target.value })}
            className="h-7 rounded-md border border-zinc-200 dark:border-[#1a1a1a] bg-white dark:bg-[#111] text-xs px-2"
          >
            {Object.keys(PRIORITY_CONFIG).map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
          <select
            value={selectedTicket.assignee?.id || ""}
            onChange={(e) => updateTicket(selectedTicket.id, { assigneeId: e.target.value || null })}
            className="h-7 rounded-md border border-zinc-200 dark:border-[#1a1a1a] bg-white dark:bg-[#111] text-xs px-2"
          >
            <option value="">Unassigned</option>
            {members.map((m) => <option key={m.userId} value={m.userId}>{m.user.name}</option>)}
          </select>
        </div>

        {/* Description */}
        {selectedTicket.description && (
          <div className="px-6 py-3 border-b border-zinc-100 dark:border-[#111]">
            <p className="text-sm text-foreground/80 whitespace-pre-wrap">{selectedTicket.description}</p>
          </div>
        )}

        {/* Messages */}
        <div className="flex-1 overflow-auto px-6 py-4 space-y-3">
          {selectedTicket.messages?.map((msg) => (
            <div key={msg.id} className={`rounded-xl p-3 ${
              msg.isInternal
                ? "bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800/30"
                : "bg-zinc-50 dark:bg-[#0d0d0d] border border-zinc-200 dark:border-[#1a1a1a]"
            }`}>
              <div className="flex items-center gap-2 mb-1.5">
                <span className="text-xs font-semibold">{msg.author.name}</span>
                {msg.isInternal && <span className="text-[9px] px-1 py-0.5 rounded bg-amber-200 dark:bg-amber-800/40 text-amber-700 dark:text-amber-300 font-medium">Internal</span>}
                <span className="text-[10px] text-muted-foreground ml-auto">
                  {new Date(msg.createdAt).toLocaleString()}
                </span>
              </div>
              <p className="text-sm text-foreground/80 whitespace-pre-wrap">{msg.content}</p>
            </div>
          ))}
        </div>

        {/* Reply */}
        <div className="border-t border-zinc-200 dark:border-[#1a1a1a] px-6 py-3">
          <div className="flex items-center gap-2 mb-2">
            <button
              onClick={() => setIsInternal(false)}
              className={`text-xs px-2 py-1 rounded transition-colors ${!isInternal ? "bg-purple-100 dark:bg-purple-500/10 text-purple-600" : "text-muted-foreground hover:bg-zinc-100 dark:hover:bg-zinc-800"}`}
            >
              Reply
            </button>
            <button
              onClick={() => setIsInternal(true)}
              className={`text-xs px-2 py-1 rounded transition-colors ${isInternal ? "bg-amber-100 dark:bg-amber-500/10 text-amber-600" : "text-muted-foreground hover:bg-zinc-100 dark:hover:bg-zinc-800"}`}
            >
              Internal Note
            </button>
          </div>
          <div className="flex items-end gap-2">
            <textarea
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder={isInternal ? "Add internal note..." : "Write a reply..."}
              className="flex-1 resize-none text-sm bg-zinc-50 dark:bg-[#0d0d0d] border border-zinc-200 dark:border-[#1a1a1a] rounded-lg px-3 py-2 outline-none focus:border-purple-500/50 min-h-[60px]"
            />
            <Button
              onClick={sendMessage}
              disabled={sendingMsg || !newMessage.trim()}
              size="sm"
              className="gap-1.5 bg-purple-600 hover:bg-purple-700 text-white shrink-0"
            >
              {sendingMsg ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Ticket List View
  return (
    <div className="flex-1 flex flex-col min-w-0">
      <div className="flex items-center gap-3 px-6 py-4 border-b border-zinc-200 dark:border-[#1a1a1a]">
        <Button variant="ghost" size="icon-sm" onClick={onBack}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <AlertTriangle className="h-5 w-5 text-purple-500" />
        <div className="flex-1">
          <h2 className="text-lg font-bold">Tickets</h2>
          <p className="text-xs text-muted-foreground">{totalOpen} open</p>
        </div>
        <Button onClick={() => setCreating(true)} size="sm" className="gap-1.5 bg-purple-600 hover:bg-purple-700 text-white">
          <Plus className="h-3.5 w-3.5" /> New Ticket
        </Button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 px-4 py-2 border-b border-zinc-100 dark:border-[#111] overflow-x-auto">
        {["all", "OPEN", "IN_PROGRESS", "WAITING", "RESOLVED", "CLOSED"].map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`text-xs px-2.5 py-1 rounded-lg whitespace-nowrap transition-colors ${
              filter === f ? "bg-purple-100 dark:bg-purple-500/10 text-purple-600" : "text-muted-foreground hover:bg-zinc-100 dark:hover:bg-zinc-800"
            }`}
          >
            {f === "all" ? "All" : f.replace("_", " ")}
            {f !== "all" && stats[f] ? ` (${stats[f]})` : ""}
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="px-4 py-2 border-b border-zinc-100 dark:border-[#111]">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search tickets..."
            className="pl-8 h-8 text-sm"
          />
        </div>
      </div>

      {/* Create ticket form */}
      {creating && (
        <div className="px-4 py-4 border-b border-zinc-200 dark:border-[#1a1a1a] bg-zinc-50/50 dark:bg-[#0a0a0a]/50 space-y-3">
          <Input value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder="Ticket title" className="h-9 font-medium" autoFocus />
          <textarea
            value={newDesc}
            onChange={(e) => setNewDesc(e.target.value)}
            placeholder="Description (optional)"
            className="w-full resize-none text-sm bg-white dark:bg-[#111] border border-zinc-200 dark:border-[#1a1a1a] rounded-lg px-3 py-2 outline-none min-h-[60px]"
          />
          <div className="flex items-center gap-2">
            <select value={newPriority} onChange={(e) => setNewPriority(e.target.value)} className="h-8 rounded-md border border-zinc-200 dark:border-[#1a1a1a] bg-white dark:bg-[#111] text-xs px-2">
              {Object.entries(PRIORITY_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
            <select value={newAssignee} onChange={(e) => setNewAssignee(e.target.value)} className="h-8 rounded-md border border-zinc-200 dark:border-[#1a1a1a] bg-white dark:bg-[#111] text-xs px-2 flex-1">
              <option value="">Unassigned</option>
              {members.map((m) => <option key={m.userId} value={m.userId}>{m.user.name}</option>)}
            </select>
            <Button onClick={createTicket} disabled={submitting || !newTitle.trim()} size="sm" className="gap-1.5 bg-purple-600 hover:bg-purple-700 text-white">
              {submitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
              Create
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setCreating(false)}>Cancel</Button>
          </div>
        </div>
      )}

      {/* Ticket list */}
      <div className="flex-1 overflow-auto">
        {loading && tickets.length === 0 ? (
          <div className="flex items-center justify-center h-32">
            <Loader2 className="h-5 w-5 animate-spin text-purple-500" />
          </div>
        ) : tickets.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-muted-foreground">
            <AlertTriangle className="h-10 w-10 mb-3 opacity-20" />
            <p className="text-sm">No tickets found</p>
          </div>
        ) : (
          <div>
            {tickets.map((ticket) => {
              const sc = STATUS_CONFIG[ticket.status] || STATUS_CONFIG.OPEN;
              const SIcon = sc.icon;
              const pc = PRIORITY_CONFIG[ticket.priority] || PRIORITY_CONFIG.MEDIUM;
              const PIcon = pc.icon;

              return (
                <button
                  key={ticket.id}
                  onClick={() => fetchTicketDetail(ticket.id)}
                  className="w-full text-left px-4 py-3 border-b border-zinc-100 dark:border-[#111] hover:bg-zinc-50 dark:hover:bg-zinc-900/40 transition-colors"
                >
                  <div className="flex items-start gap-3">
                    <SIcon className={`h-4 w-4 mt-0.5 shrink-0 ${sc.color}`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono text-muted-foreground">#{ticket.number}</span>
                        <PIcon className={`h-3 w-3 ${pc.color}`} />
                      </div>
                      <p className="text-sm font-semibold truncate">{ticket.title}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[10px] text-muted-foreground">{ticket.creator.name}</span>
                        {ticket.assignee && (
                          <span className="text-[10px] text-purple-500">&rarr; {ticket.assignee.name}</span>
                        )}
                        {ticket._count?.messages ? (
                          <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                            <MessageSquare className="h-2.5 w-2.5" /> {ticket._count.messages}
                          </span>
                        ) : null}
                        <span className="text-[10px] text-muted-foreground ml-auto">
                          {new Date(ticket.updatedAt).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
