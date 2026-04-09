"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { MessageCircle, Send, RotateCcw, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { useSession } from "@/lib/auth-client";
import { ClientMarkdown } from "@/features/markdown/client-markdown";

type ChatMessage = {
  id: string;
  conversation_id: string;
  role: "user" | "assistant" | "admin";
  content: string;
  metadata: Record<string, unknown>;
  created_at: string;
};

type ChatConversation = {
  id: string;
  user_id: string;
  status: "active" | "pending_human" | "resolved" | "archived";
  subject: string | null;
  escalated_at: string | null;
  last_message_at: string;
  created_at: string;
};

type AskResponse = {
  ok: boolean;
  user_message: ChatMessage;
  assistant_message: ChatMessage;
  meta: {
    should_escalate: boolean;
    escalation_reason: string | null;
    detected_feature_request: {
      title: string;
      description: string;
      category: string;
    } | null;
    confidence: number;
  };
};

/**
 * Floating chat widget for Léa, the BriefTube AI support agent.
 * Renders a button bottom-right on every page when the user is authenticated.
 */
export function LeaChatWidget() {
  const session = useSession();
  const [open, setOpen] = useState(false);
  const [conversation, setConversation] = useState<ChatConversation | null>(
    null,
  );
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, sending]);

  // Load existing conversation when widget opens
  useEffect(() => {
    if (!open || !session.data?.user) return;
    let cancelled = false;
    setLoading(true);

    void fetch("/api/chat/conversations")
      .then(async (r) => r.json())
      .then(
        (data: {
          conversation: ChatConversation | null;
          messages: ChatMessage[];
        }) => {
          if (cancelled) return;
          setConversation(data.conversation);
          setMessages(data.messages);
        },
      )
      .catch(() => {
        if (cancelled) return;
        toast.error("Couldn't load conversation");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open, session.data?.user]);

  // Focus input when opening
  useEffect(() => {
    if (open && !loading) {
      const t = setTimeout(() => inputRef.current?.focus(), 100);
      return () => clearTimeout(t);
    }
  }, [open, loading]);

  const ensureConversation =
    useCallback(async (): Promise<ChatConversation | null> => {
      if (conversation) return conversation;
      const res = await fetch("/api/chat/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      if (!res.ok) {
        toast.error("Couldn't start the conversation");
        return null;
      }
      const data = (await res.json()) as {
        conversation: ChatConversation;
        messages: ChatMessage[];
      };
      setConversation(data.conversation);
      setMessages(data.messages);
      return data.conversation;
    }, [conversation]);

  const sendMessage = useCallback(async () => {
    const text = input.trim();
    if (!text || sending) return;

    const conv = await ensureConversation();
    if (!conv) return;

    setSending(true);
    setInput("");

    // Optimistic user message
    const optimistic: ChatMessage = {
      id: `opt-${Date.now()}`,
      conversation_id: conv.id,
      role: "user",
      content: text,
      metadata: {},
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimistic]);

    try {
      const res = await fetch("/api/chat/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId: conv.id, message: text }),
      });

      if (!res.ok) {
        throw new Error("ask failed");
      }

      const data = (await res.json()) as AskResponse;

      setMessages((prev) => {
        const withoutOpt = prev.filter((m) => m.id !== optimistic.id);
        return [...withoutOpt, data.user_message, data.assistant_message];
      });

      if (data.meta.should_escalate) {
        setConversation((c) =>
          c
            ? {
                ...c,
                status: "pending_human",
                escalated_at: new Date().toISOString(),
              }
            : c,
        );
      }
    } catch {
      setMessages((prev) => prev.filter((m) => m.id !== optimistic.id));
      toast.error("Léa couldn't reply. Try again in a moment.");
    } finally {
      setSending(false);
    }
  }, [input, sending, ensureConversation]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void sendMessage();
    }
  };

  const escalateManually = useCallback(async () => {
    if (!conversation) return;
    try {
      const res = await fetch("/api/chat/escalate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversationId: conversation.id,
          reason: "user_clicked_contact_human",
        }),
      });
      if (!res.ok) throw new Error("escalate failed");
      setConversation((c) =>
        c
          ? {
              ...c,
              status: "pending_human",
              escalated_at: new Date().toISOString(),
            }
          : c,
      );
      toast.success("Vin has been notified. He'll get back to you soon");
    } catch {
      toast.error("Couldn't pass it on. Try again.");
    }
  }, [conversation]);

  const startNewConversation = useCallback(async () => {
    setLoading(true);
    setMessages([]);
    setConversation(null);
    try {
      const res = await fetch("/api/chat/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      if (!res.ok) throw new Error("create failed");
      const data = (await res.json()) as {
        conversation: ChatConversation;
        messages: ChatMessage[];
      };
      setConversation(data.conversation);
      setMessages(data.messages);
    } catch {
      toast.error("Couldn't start a new conversation");
    } finally {
      setLoading(false);
    }
  }, []);

  if (!session.data?.user) return null;

  return (
    <>
      {/* Floating button */}
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Open BriefTube support"
          className="fixed right-5 bottom-24 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-blue-600 text-white shadow-lg shadow-blue-600/30 transition hover:scale-105 hover:bg-blue-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 sm:bottom-5"
        >
          <MessageCircle className="h-6 w-6" />
        </button>
      )}

      {/* Sheet panel */}
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          side="right"
          className="flex h-full w-full max-w-md flex-col gap-0 p-0 sm:max-w-md"
        >
          <SheetHeader className="border-border/60 border-b px-5 py-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex flex-col gap-0.5">
                <SheetTitle className="text-base font-semibold">
                  Léa, BriefTube Support
                </SheetTitle>
                <SheetDescription className="text-muted-foreground text-xs">
                  {conversation?.status === "pending_human"
                    ? "Vin will take over soon"
                    : "Ask me anything, I reply right away"}
                </SheetDescription>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => void startNewConversation()}
                title="New conversation"
                className="mr-8"
              >
                <RotateCcw className="h-4 w-4" />
              </Button>
            </div>
          </SheetHeader>

          {/* Messages area */}
          <div className="flex-1 overflow-y-auto px-5 py-4">
            {loading && (
              <p className="text-muted-foreground text-sm">Loading…</p>
            )}

            {!loading && messages.length === 0 && (
              <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-500/10">
                  <MessageCircle className="h-6 w-6 text-blue-500" />
                </div>
                <p className="text-foreground text-sm font-medium">
                  Hi, I'm Léa
                </p>
                <p className="text-muted-foreground max-w-[280px] text-xs leading-relaxed">
                  Ask me anything about BriefTube: billing, Telegram, features,
                  bugs… I'm here to help. If I can't answer, I'll pass it to
                  Vin. I reply in your language.
                </p>
              </div>
            )}

            <div className="flex flex-col gap-4">
              {messages.map((msg) => (
                <MessageBubble key={msg.id} message={msg} />
              ))}
              {sending && (
                <div className="flex gap-2 self-start">
                  <div className="bg-muted text-muted-foreground rounded-2xl rounded-bl-md px-4 py-2 text-sm">
                    <span className="inline-flex gap-1">
                      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-current [animation-delay:0ms]" />
                      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-current [animation-delay:150ms]" />
                      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-current [animation-delay:300ms]" />
                    </span>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          </div>

          {/* Footer with input + escalate */}
          <div className="border-border/60 border-t px-5 py-3">
            <div className="flex items-end gap-2">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Type your message…"
                rows={1}
                disabled={sending || loading}
                className="border-input bg-background text-foreground placeholder:text-muted-foreground focus-visible:ring-ring max-h-32 min-h-[40px] flex-1 resize-none rounded-md border px-3 py-2 text-sm focus-visible:ring-1 focus-visible:outline-none disabled:opacity-50"
              />
              <Button
                size="icon"
                onClick={() => void sendMessage()}
                disabled={sending || loading || input.trim().length === 0}
                aria-label="Send"
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>

            {conversation && conversation.status !== "pending_human" && (
              <button
                type="button"
                onClick={() => void escalateManually()}
                className="text-muted-foreground hover:text-foreground mt-2 inline-flex items-center gap-1 text-xs transition"
              >
                <AlertCircle className="h-3 w-3" />
                Not helpful, contact Vin directly
              </button>
            )}
            {conversation?.status === "pending_human" && (
              <p className="text-muted-foreground mt-2 inline-flex items-center gap-1 text-xs">
                <AlertCircle className="h-3 w-3 text-amber-500" />
                Vin has been notified, he'll reply by email and here
              </p>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}

function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === "user";
  const isAdmin = message.role === "admin";

  return (
    <div
      className={cn(
        "flex max-w-[85%] flex-col gap-1",
        isUser ? "items-end self-end" : "items-start self-start",
      )}
    >
      {isAdmin && (
        <span className="text-xs font-medium text-amber-600">
          Vin (founder)
        </span>
      )}
      <div
        className={cn(
          "rounded-2xl px-4 py-2 text-sm",
          isUser && "rounded-br-md bg-blue-600 text-white",
          !isUser && !isAdmin && "bg-muted text-foreground rounded-bl-md",
          isAdmin &&
            "text-foreground rounded-bl-md border border-amber-500/30 bg-amber-500/10",
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
