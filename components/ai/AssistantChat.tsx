'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { askAi, confirmAgentAction, cancelAgentAction } from '@/lib/actions/ai';
import { UserRole } from '@prisma/client';
import {
  Mic,
  Send,
  Sparkles,
  User,
  Bot,
  TrendingUp,
  Package,
  Truck,
  Receipt,
  HelpCircle,
  CheckCircle2,
  XCircle,
  Loader2,
} from 'lucide-react';

type UserSummary = { id: string; name: string; role: UserRole };

type PendingAction = {
  id: string;
  actionType: string;
  humanSummary: string;
};

type ChatMessage = {
  role: 'user' | 'ai';
  text: string;
  tool?: string;
  actions?: { label: string; href: string }[];
};

const toolIcons: Record<string, React.ElementType> = {
  prices: TrendingUp,
  myCrops: Package,
  myOffers: Receipt,
  myDeals: Truck,
  myPayments: Receipt,
  sourcing: Package,
  receiving: Truck,
  arhtiInventory: Package,
  arhtiAuctions: TrendingUp,
  arhtiSales: Receipt,
  vendorAuctions: TrendingUp,
  vendorStock: Package,
  vendorWholesale: Receipt,
  shopWholesale: TrendingUp,
  shopStock: Package,
  shopOrders: Receipt,
  adminChain: TrendingUp,
  help: HelpCircle,
};

export default function AssistantChat({
  user,
  initialSessionId,
  initialHistory,
  pendingActions,
  quickPrompts,
}: {
  user: UserSummary;
  initialSessionId?: string;
  initialHistory: ChatMessage[];
  pendingActions: PendingAction[];
  quickPrompts: string[];
}) {
  const router = useRouter();
  const [sessionId, setSessionId] = useState(initialSessionId);
  const [messages, setMessages] = useState<ChatMessage[]>(
    initialHistory.length
      ? initialHistory
      : [
          {
            role: 'ai',
            text: `As-salamu alaykum ${user.name}! I am AgriConnect AI, set up for your ${user.role.toLowerCase()} work. Ask me anything on your desk — or say "help" to see what I can pull up.`,
            tool: 'help',
          },
        ]
  );
  const [input, setInput] = useState('');
  const [pending, setPending] = useState<PendingAction[]>(pendingActions);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  async function handleSubmit(e?: React.FormEvent) {
    e?.preventDefault();
    const text = input.trim();
    if (!text || loading) return;

    setLoading(true);
    setError(null);
    setInput('');
    setMessages((prev) => [...prev, { role: 'user', text }]);

    const formData = new FormData();
    if (sessionId) formData.set('sessionId', sessionId);
    formData.set('message', text);

    const result = await askAi(formData);
    setLoading(false);

    if (result.error) {
      setError(result.error);
      return;
    }

    if (result.success) {
      setSessionId(result.sessionId);
      setMessages((prev) => [
        ...prev,
        {
          role: 'ai',
          text: result.replyUrdu ? `${result.reply}\n\n${result.replyUrdu}` : result.reply,
          tool: result.tool,
          actions: result.suggestedActions,
        },
      ]);
      if (result.pendingActionId) {
        setPending((prev) => [
          ...prev,
          {
            id: result.pendingActionId!,
            actionType: result.pendingActionType ?? result.tool,
            humanSummary: result.pendingActionSummary ?? 'Review requested action',
          },
        ]);
      }
    }
  }

  async function handleConfirm(actionId: string) {
    setLoading(true);
    const formData = new FormData();
    formData.set('actionId', actionId);
    const result = await confirmAgentAction(formData);
    setLoading(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setPending((prev) => prev.filter((a) => a.id !== actionId));
    if (result.href) router.push(result.href);
  }

  async function handleCancel(actionId: string) {
    const formData = new FormData();
    formData.set('actionId', actionId);
    const result = await cancelAgentAction(formData);
    if (result.error) {
      setError(result.error);
      return;
    }
    setPending((prev) => prev.filter((a) => a.id !== actionId));
  }

  function renderTextWithLineBreaks(text: string) {
    return text.split('\n').map((line, i) => (
      <span key={i} className="block">
        {line}
      </span>
    ));
  }

  return (
    <div className="flex flex-col h-full bg-white border border-[#E5E7EB] rounded-2xl shadow-sm overflow-hidden">
      {/* Header */}
      <div className="bg-[#E8F3EE] border-b border-[#B7D4C8] p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-agri-900 text-white flex items-center justify-center">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-agri-900">AgriConnect AI</h1>
            <p className="text-[10px] text-agri-900/80">Voice-first mandi assistant</p>
          </div>
        </div>
        <span className="text-[10px] bg-white text-agri-900 border border-[#B7D4C8] px-2 py-0.5 rounded-full font-semibold">
          {user.role}
        </span>
      </div>

      {/* Pending actions */}
      {pending.length > 0 && (
        <div className="bg-amber-50 border-b border-amber-200 p-3 space-y-2">
          <div className="text-[10px] font-bold uppercase tracking-wider text-amber-800">Pending Actions</div>
          {pending.map((action) => (
            <div
              key={action.id}
              className="flex items-center justify-between bg-white border border-amber-200 rounded-lg p-2.5"
            >
              <div className="text-xs text-charcoal">
                <span className="font-semibold">{action.actionType.replace(/_/g, ' ')}</span>
                <span className="text-[#636E72] ml-1">— {action.humanSummary}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => handleConfirm(action.id)}
                  disabled={loading}
                  className="flex items-center gap-1 bg-agri-900 hover:bg-agri-800 disabled:opacity-50 text-white text-[10px] font-semibold px-2 py-1 rounded transition-colors"
                >
                  <CheckCircle2 className="w-3 h-3" /> Confirm
                </button>
                <button
                  onClick={() => handleCancel(action.id)}
                  disabled={loading}
                  className="flex items-center gap-1 bg-white hover:bg-rose-50 text-rose-700 border border-rose-200 disabled:opacity-50 text-[10px] font-semibold px-2 py-1 rounded transition-colors"
                >
                  <XCircle className="w-3 h-3" /> Cancel
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-[#F8F9F5]">
        {messages.map((msg, idx) => {
          const isUser = msg.role === 'user';
          const Icon = isUser ? User : toolIcons[msg.tool || 'help'] || Bot;
          return (
            <div key={idx} className={`flex gap-2.5 ${isUser ? 'flex-row-reverse' : ''}`}>
              <div
                className={`w-8 h-8 rounded-full shrink-0 flex items-center justify-center ${
                  isUser ? 'bg-[#E5E7EB] text-charcoal' : 'bg-agri-900 text-white'
                }`}
              >
                <Icon className="w-4 h-4" />
              </div>
              <div className="max-w-[80%] space-y-2">
                <div
                  className={`rounded-2xl px-4 py-2.5 text-xs leading-relaxed whitespace-pre-line ${
                    isUser
                      ? 'bg-agri-900 text-white rounded-br-none'
                      : 'bg-white border border-[#E5E7EB] text-charcoal rounded-bl-none shadow-sm'
                  }`}
                >
                  {renderTextWithLineBreaks(msg.text)}
                </div>
                {!isUser && msg.actions && msg.actions.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {msg.actions.map((action) => (
                      <Link
                        key={action.href + action.label}
                        href={action.href}
                        className="text-[10px] font-semibold text-agri-900 bg-white border border-[#B7D4C8] hover:bg-[#E8F3EE] rounded-full px-2.5 py-1 transition-colors"
                      >
                        {action.label}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}
        {loading && (
          <div className="flex gap-2.5">
            <div className="w-8 h-8 rounded-full bg-agri-900 text-white flex items-center justify-center">
              <Bot className="w-4 h-4" />
            </div>
            <div className="bg-white border border-[#E5E7EB] rounded-2xl rounded-bl-none px-4 py-2.5 text-xs text-[#636E72] flex items-center gap-2">
              <Loader2 className="w-3.5 h-3.5 animate-spin" /> AgriConnect AI is thinking...
            </div>
          </div>
        )}
        {error && (
          <div className="bg-rose-50 border border-rose-200 text-rose-700 text-xs p-3 rounded-lg">{error}</div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Quick prompts */}
      <div className="bg-white border-t border-[#E5E7EB] px-4 pt-3 pb-1">
        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
          {quickPrompts.map((prompt) => (
            <button
              key={prompt}
              onClick={() => setInput(prompt)}
              className="flex items-center gap-1.5 bg-[#F8F9F5] hover:bg-[#E8F3EE] text-charcoal border border-[#E5E7EB] rounded-full px-3 py-1.5 text-[11px] font-medium whitespace-nowrap transition-colors"
            >
              <Sparkles className="w-3.5 h-3.5 text-agri-900" />
              {prompt}
            </button>
          ))}
        </div>
      </div>

      {/* Input */}
      <form onSubmit={handleSubmit} className="p-4 bg-white border-t border-[#E5E7EB]">
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="p-2.5 rounded-full bg-[#F8F9F5] hover:bg-[#E8F3EE] text-agri-900 border border-[#E5E7EB] transition-colors"
            title="Voice input (simulated)"
            onClick={() => setInput('Tomato price today?')}
          >
            <Mic className="w-4 h-4" />
          </button>
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask AgriConnect AI in English or Urdu..."
            className="flex-1 bg-[#F8F9F5] border border-[#E5E7EB] rounded-xl px-4 py-2.5 text-xs text-charcoal placeholder:text-[#636E72] focus:outline-none focus:ring-2 focus:ring-agri-900/20"
          />
          <button
            type="submit"
            disabled={!input.trim() || loading}
            className="p-2.5 rounded-full bg-agri-900 hover:bg-agri-800 disabled:opacity-50 disabled:cursor-not-allowed text-white transition-colors"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </form>
    </div>
  );
}
