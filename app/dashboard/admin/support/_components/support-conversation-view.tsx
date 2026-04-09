"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  CheckCircle2,
  Send,
  RotateCw,
  Mail,
  User as UserIcon,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { ClientMarkdown } from "@/features/markdown/client-markdown";
import { createClient } from "@/lib/supabase/client";

type Message = {
  id: string;
  conversation_id: string;
  role: "user" | "assistant" | "admin";
  content: string;
  metadata: Record<string, unknown>;
  created_at: string;
};

type Conversation = {
  id: string;
  user_id: string;
  status: "active" | "pending_human" | "resolved" | "archived";
  subject: string | null;
  escalated_at: string | null;
  escalation_reason: string | null;
  resolved_at: string | null;
  last_message_at: string;
  unread_by_admin: boolean;
  created_at: string;
};

type UserProfile = {
  id: string;
  email: string;
  subscription_status: string | null;
  max_channels: number | null;
  telegram_connected: boolean | null;
  preferred_language: string | null;
  trial_ends_at: string | null;
  onboarding_completed: boolean | null;
  created_at: string | null;
} | null;

export function SupportConversationView({
  conversation: initialConversation,
  initialMessages,
  userProfile,
}: {
  conversation: Conversation;
  initialMessages: Message[];
  userProfile: UserProfile;
}) {
  const [conversation, setConversation] = useState(initialConversation);
  const [messages, setMessages] = useState(initialMessages);
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);
  const [resolveOnSend, setResolveOnSend] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`admin-support-conv-${conversation.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "chat_messages",
          filter: `conversation_id=eq.${conversation.id}`,
        },
        (payload) => {
          const newMsg = payload.new as Message;
          setMessages((prev) => {
            if (prev.some((m) => m.id === newMsg.id)) return prev;
            return [...prev, newMsg];
          });
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [conversation.id]);

  const sendReply = async () => {
    const text = reply.trim();
    if (!text || sending) return;

    setSending(true);
    try {
      const res = await fetch(`/api/admin/chat/${conversation.id}/reply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          resolve: resolveOnSend,
          notify_email: true,
        }),
      });
      if (!res.ok) throw new Error("reply failed");
      const data = (await res.json()) as { message: Message };
      setMessages((prev) => [...prev, data.message]);
      setReply("");
      if (resolveOnSend) {
        setConversation((c) => ({ ...c, status: "resolved" }));
        setResolveOnSend(false);
      } else {
        setConversation((c) => ({ ...c, status: "active" }));
      }
      toast.success("Reply sent and email delivered to user");
    } catch {
      toast.error("Couldn't send the reply");
    } finally {
      setSending(false);
    }
  };

  const updateStatus = async (
    status: "active" | "pending_human" | "resolved" | "archived",
  ) => {
    try {
      const res = await fetch(`/api/admin/chat/${conversation.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error("update failed");
      setConversation((c) => ({ ...c, status }));
      toast.success(`Conversation: ${status}`);
    } catch {
      toast.error("Couldn't update");
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button asChild variant="ghost" size="sm">
            <Link href="/dashboard/admin/support">
              <ArrowLeft className="size-4" />
              Inbox
            </Link>
          </Button>
          <div className="flex flex-col">
            <h1 className="text-base font-semibold">
              {conversation.subject ?? "(no subject)"}
            </h1>
            <p className="text-muted-foreground text-xs">
              {userProfile?.email ?? "(unknown user)"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {conversation.status !== "resolved" && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => void updateStatus("resolved")}
            >
              <CheckCircle2 className="size-4" />
              Mark resolved
            </Button>
          )}
          {conversation.status === "resolved" && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => void updateStatus("active")}
            >
              <RotateCw className="size-4" />
              Reopen
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-[1fr_280px]">
        {/* Chat */}
        <div className="border-border/60 bg-card flex flex-col rounded-lg border">
          <div className="flex max-h-[60vh] flex-col gap-3 overflow-y-auto p-4">
            {messages.length === 0 ? (
              <p className="text-muted-foreground text-sm">No messages yet.</p>
            ) : (
              messages.map((msg) => <MessageRow key={msg.id} message={msg} />)
            )}
            <div ref={messagesEndRef} />
          </div>
          {/* Reply */}
          <div className="border-border/60 border-t p-4">
            <textarea
              value={reply}
              onChange={(e) => setReply(e.target.value)}
              placeholder="Reply as Vin…"
              rows={4}
              disabled={sending}
              className="border-input bg-background focus-visible:ring-ring w-full resize-none rounded-md border px-3 py-2 text-sm focus-visible:ring-1 focus-visible:outline-none disabled:opacity-50"
            />
            <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
              <label className="text-muted-foreground flex items-center gap-2 text-xs">
                <input
                  type="checkbox"
                  checked={resolveOnSend}
                  onChange={(e) => setResolveOnSend(e.target.checked)}
                  className="size-3"
                />
                Mark resolved after sending
              </label>
              <Button
                size="sm"
                onClick={() => void sendReply()}
                disabled={sending || reply.trim().length === 0}
              >
                <Send className="size-4" />
                Send + email
              </Button>
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <aside className="border-border/60 bg-card flex flex-col gap-4 rounded-lg border p-4">
          <div className="flex flex-col gap-1">
            <h3 className="text-foreground text-sm font-semibold">User</h3>
            <p className="text-muted-foreground text-xs">Profile and plan</p>
          </div>
          {userProfile ? (
            <dl className="flex flex-col gap-2 text-xs">
              <Field
                icon={<Mail className="size-3" />}
                label="Email"
                value={userProfile.email}
              />
              <Field
                icon={<UserIcon className="size-3" />}
                label="Plan"
                value={
                  <Badge variant="outline" className="text-xs">
                    {userProfile.subscription_status ?? "free"}
                  </Badge>
                }
              />
              <Field
                label="Telegram"
                value={userProfile.telegram_connected ? "Connected" : "No"}
              />
              <Field
                label="Max channels"
                value={String(userProfile.max_channels ?? "?")}
              />
              <Field
                label="Language"
                value={userProfile.preferred_language ?? "n/a"}
              />
              <Field
                label="Onboarding"
                value={userProfile.onboarding_completed ? "Yes" : "No"}
              />
              <Field
                label="Joined"
                value={
                  userProfile.created_at
                    ? new Date(userProfile.created_at).toLocaleDateString(
                        "en-US",
                      )
                    : "n/a"
                }
              />
              {userProfile.trial_ends_at && (
                <Field
                  label="Trial until"
                  value={new Date(userProfile.trial_ends_at).toLocaleDateString(
                    "en-US",
                  )}
                />
              )}
            </dl>
          ) : (
            <p className="text-muted-foreground text-xs">Profile not found</p>
          )}
          <div className="border-border/60 border-t pt-3">
            <h4 className="text-foreground mb-2 text-xs font-semibold">
              Conversation
            </h4>
            <dl className="flex flex-col gap-1 text-xs">
              <Field label="Status" value={conversation.status} />
              <Field
                label="Created"
                value={new Date(conversation.created_at).toLocaleString(
                  "en-US",
                )}
              />
              {conversation.escalated_at && (
                <Field
                  label="Escalated"
                  value={new Date(conversation.escalated_at).toLocaleString(
                    "en-US",
                  )}
                />
              )}
              {conversation.escalation_reason && (
                <Field label="Reason" value={conversation.escalation_reason} />
              )}
            </dl>
          </div>
        </aside>
      </div>
    </div>
  );
}

function Field({
  icon,
  label,
  value,
}: {
  icon?: React.ReactNode;
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-2">
      <dt className="text-muted-foreground flex items-center gap-1">
        {icon}
        {label}
      </dt>
      <dd className="text-foreground text-right">{value}</dd>
    </div>
  );
}

function MessageRow({ message }: { message: Message }) {
  const isUser = message.role === "user";
  const isAdmin = message.role === "admin";
  const label = isUser ? "User" : isAdmin ? "Vin" : "Léa";
  const labelColor = isUser
    ? "text-blue-600"
    : isAdmin
      ? "text-amber-600"
      : "text-emerald-600";

  const escalated =
    !isUser && !isAdmin && Boolean(message.metadata.should_escalate);

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-2 text-xs">
        <span className={cn("font-semibold", labelColor)}>{label}</span>
        <span className="text-muted-foreground">
          {new Date(message.created_at).toLocaleTimeString("en-US", {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </span>
        {escalated && (
          <Badge
            variant="outline"
            className="border-amber-500/30 bg-amber-500/15 text-xs text-amber-600"
          >
            escalated
          </Badge>
        )}
      </div>
      <div
        className={cn(
          "rounded-md p-3 text-sm",
          isUser && "border border-blue-500/20 bg-blue-500/5",
          isAdmin && "border border-amber-500/20 bg-amber-500/5",
          !isUser && !isAdmin && "bg-muted/50 border-border/60 border",
        )}
      >
        {isUser ? (
          <p className="break-words whitespace-pre-wrap">{message.content}</p>
        ) : (
          <ClientMarkdown className="prose-sm max-w-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
            {message.content}
          </ClientMarkdown>
        )}
      </div>
    </div>
  );
}
