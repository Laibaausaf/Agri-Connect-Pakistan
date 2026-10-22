'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {askAi, confirmAgentAction, cancelAgentAction,} from '@/lib/actions/natural-ai';
import { UserRole } from '@prisma/client';
import {
  Mic,
  MicOff,
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

type UserSummary = {
  id: string;
  name: string;
  role: UserRole;
};

type PendingAction = {
  id: string;
  actionType: string;
  humanSummary: string;
};

type ChatMessage = {
  role: 'user' | 'ai';
  text: string;
  tool?: string;
  actions?: {
    label: string;
    href: string;
  }[];
};

/*
 * Type declarations for the browser Web Speech API.
 *
 * Chrome and Edge commonly expose this as webkitSpeechRecognition.
 * Some browsers expose SpeechRecognition directly.
 */
interface SpeechRecognitionAlternativeLike {
  transcript: string;
  confidence: number;
}

interface SpeechRecognitionResultLike {
  isFinal: boolean;
  length: number;
  [index: number]: SpeechRecognitionAlternativeLike;
}

interface SpeechRecognitionResultListLike {
  length: number;
  [index: number]: SpeechRecognitionResultLike;
}

interface SpeechRecognitionEventLike extends Event {
  resultIndex: number;
  results: SpeechRecognitionResultListLike;
}

interface SpeechRecognitionErrorEventLike extends Event {
  error: string;
  message?: string;
}

interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;

  start: () => void;
  stop: () => void;
  abort: () => void;

  onstart: (() => void) | null;
  onend: (() => void) | null;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null;
}

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

declare global {
  interface Window {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  }
}

type VoiceLanguage = 'ur-PK' | 'en-US';

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

/*
 * Detect Urdu script so the UI can decide which AI response to show.
 *
 * Roman Urdu is intentionally treated as Latin text. The existing backend
 * already understands a number of Roman Urdu agricultural terms.
 */
function containsUrduScript(text: string) {
  return /[\u0600-\u06FF]/.test(text);
}

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
            text: `As-salamu alaykum ${user.name}! I am AgriConnect AI, set up for your ${user.role.toLowerCase()} work. You can type or speak in English, Urdu, or Roman Urdu.`,
            tool: 'help',
          },
        ]
  );

  const [input, setInput] = useState('');
  const [pending, setPending] = useState<PendingAction[]>(pendingActions);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /*
   * Voice state
   */
  const [speechSupported, setSpeechSupported] = useState(true);
  const [isListening, setIsListening] = useState(false);
  const [interimTranscript, setInterimTranscript] = useState('');
  const [voiceLanguage, setVoiceLanguage] = useState<VoiceLanguage>('ur-PK');

  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  /*
   * Keeps the message area scrolled to the latest message.
   */
  useEffect(() => {
    // Scroll only the chat message pane, never the whole document/page.
    // This prevents the assistant screen from jumping when a reply arrives.
    const container = messagesContainerRef.current;
    if (!container) return;

    container.scrollTo({
      top: container.scrollHeight,
      behavior: 'smooth',
    });
  }, [messages, loading]);

  /*
   * Detect browser speech-recognition support.
   *
   * Nothing is started here because browsers require speech recognition
   * to begin from a user interaction such as pressing the microphone.
   */
  useEffect(() => {
    const supported =
      typeof window !== 'undefined' &&
      Boolean(window.SpeechRecognition || window.webkitSpeechRecognition);

    setSpeechSupported(supported);

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.abort();
        recognitionRef.current = null;
      }
    };
  }, []);

  /*
   * Submit either typed text or a recognised voice transcript.
   *
   * Providing text directly is useful for speech recognition because React
   * state updates are asynchronous.
   */
  async function submitMessage(textOverride?: string) {
    const text = (textOverride ?? input).trim();

    if (!text || loading) {
      return;
    }

    setLoading(true);
    setError(null);
    setInput('');
    setInterimTranscript('');

    setMessages((previous) => [
      ...previous,
      {
        role: 'user',
        text,
      },
    ]);

    try {
      const formData = new FormData();

      if (sessionId) {
        formData.set('sessionId', sessionId);
      }

      formData.set('message', text);

      const result = await askAi(formData);

      /*
       * askAi returns a discriminated union. `success` exists on every
       * member, so checking it first narrows the type for the error branch.
       */
      if (!result.success) {
        setError(result.error);
        return;
      }

      if (result.success) {
        setSessionId(result.sessionId);

        /*
         * Urdu-script users receive the Urdu response when available.
         *
         * English and Roman-Urdu users receive the English response.
         *
         * This avoids displaying both languages after every message.
         */
        const responseText =
          containsUrduScript(text) && result.replyUrdu
            ? result.replyUrdu
            : result.reply;

        setMessages((previous) => [
          ...previous,
          {
            role: 'ai',
            text: responseText,
            tool: result.tool,
            actions: result.suggestedActions,
          },
        ]);

        if (result.pendingActionId) {
          setPending((previous) => [
            ...previous,
            {
              id: result.pendingActionId!,
              actionType: result.pendingActionType ?? result.tool,
              humanSummary:
                result.pendingActionSummary ?? 'Review requested action',
            },
          ]);
        }
      }
    } catch (requestError) {
      console.error('AgriConnect AI request failed:', requestError);

      setError(
        'AgriConnect AI could not process your request. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(event?: React.FormEvent) {
    event?.preventDefault();

    await submitMessage();
  }

  /*
   * Starts actual microphone recognition.
   *
   * Urdu mode:
   *   language = ur-PK
   *
   * English mode:
   *   language = en-US
   *
   * Roman Urdu does not have its own speech locale because Roman Urdu is
   * Urdu language written in Latin characters. For speech, the user should
   * use Urdu mode. Typed Roman Urdu can be entered normally.
   */
  function startVoiceRecognition() {
    setError(null);

    if (isListening) {
      recognitionRef.current?.stop();
      return;
    }

    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setSpeechSupported(false);

      setError(
        'Voice input is not supported in this browser. Please use Chrome or Microsoft Edge, or type your message.'
      );

      return;
    }

    try {
      const recognition = new SpeechRecognition();

      recognition.lang = voiceLanguage;
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.maxAlternatives = 1;

      recognitionRef.current = recognition;

      let finalTranscript = '';

      recognition.onstart = () => {
        setIsListening(true);
        setInterimTranscript('');
        setError(null);
      };

      recognition.onresult = (event) => {
        let interim = '';

        for (
          let index = event.resultIndex;
          index < event.results.length;
          index += 1
        ) {
          const result = event.results[index];

          if (!result?.[0]) {
            continue;
          }

          const transcript = result[0].transcript.trim();

          if (result.isFinal) {
            finalTranscript += `${finalTranscript ? ' ' : ''}${transcript}`;
          } else {
            interim += `${interim ? ' ' : ''}${transcript}`;
          }
        }

        if (finalTranscript) {
          setInput(finalTranscript);
          setInterimTranscript('');
        } else {
          setInterimTranscript(interim);
        }
      };

      recognition.onerror = (event) => {
        setIsListening(false);
        setInterimTranscript('');

        /*
         * "aborted" usually means the user manually stopped recognition.
         * We do not need to show that as an error.
         */
        if (event.error === 'aborted') {
          return;
        }

        if (
          event.error === 'not-allowed' ||
          event.error === 'service-not-allowed'
        ) {
          setError(
            'Microphone access is blocked. Allow microphone permission for this website and try again.'
          );

          return;
        }

        if (event.error === 'no-speech') {
          setError(
            voiceLanguage === 'ur-PK'
              ? 'Awaaz samajh nahi aayi. Dobara microphone press karke bolain.'
              : 'I could not hear anything. Press the microphone and try again.'
          );

          return;
        }

        if (event.error === 'audio-capture') {
          setError(
            'No microphone was detected. Check your microphone and browser permissions.'
          );

          return;
        }

        if (event.error === 'network') {
          setError(
            'Speech recognition could not connect. Check your internet connection and try again.'
          );

          return;
        }

        setError(
          `Voice recognition failed${
            event.error ? ` (${event.error})` : ''
          }. You can still type your message.`
        );
      };

      recognition.onend = () => {
        setIsListening(false);
        setInterimTranscript('');

        recognitionRef.current = null;

        /*
         * We intentionally do NOT automatically send the transcript.
         *
         * The recognised sentence is placed inside the input field so the
         * user can quickly correct names, quantities or crop terms before
         * submitting a financially relevant agricultural request.
         */
      };

      recognition.start();
    } catch (recognitionError) {
      console.error('Unable to start speech recognition:', recognitionError);

      setIsListening(false);

      setError(
        'The microphone could not be started. Check browser microphone permission and try again.'
      );
    }
  }

  async function handleConfirm(actionId: string) {
    setLoading(true);
    setError(null);

    const formData = new FormData();
    formData.set('actionId', actionId);

    try {
      const result = await confirmAgentAction(formData);

      if (result.error) {
        setError(result.error);
        return;
      }

      setPending((previous) =>
        previous.filter((action) => action.id !== actionId)
      );

      if ('href' in result && result.href) {
        router.push(result.href);
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleCancel(actionId: string) {
    const formData = new FormData();
    formData.set('actionId', actionId);

    const result = await cancelAgentAction(formData);

    if (result.error) {
      setError(result.error);
      return;
    }

    setPending((previous) =>
      previous.filter((action) => action.id !== actionId)
    );
  }

  /**
   * Turns an assistant reply into scannable blocks:
   *  - price lines ("Tomato · Market: Rs 92/kg ...") become cards with a big price
   *  - bullet lines become a clean list
   *  - the first line is a heading, "Note/Use these only" lines become a small note
   * Escaped newlines ("\n" shown as text) are converted to real line breaks first.
   */
  function renderMessage(rawText: string, isUser: boolean) {
    const text = rawText
      .replace(/\\+n/g, '\n')
      .replace(/\\\*\\\*/g, '')
      .replace(/\*\*/g, '')
      .trim();
    const lines = text.split('\n').map((l) => l.trim());

    if (isUser) {
      return <span className="block text-base">{text}</span>;
    }

    const priceRe = /^(.*?)\s*[·:-]\s*(.*?):\s*Rs\.?\s*([\d,]+(?:\.\d+)?)\s*\/\s*(?:kg|کلو)\s*(.*)$/i;
    const noteRe = /^(use these only|note:|یہ |نوٹ)/i;
    const out: React.ReactNode[] = [];
    let priceRows: React.ReactNode[] = [];

    const flushPrices = (key: string) => {
      if (priceRows.length) {
        out.push(
          <div key={key} className="grid gap-2 sm:grid-cols-2 my-2">
            {priceRows}
          </div>
        );
        priceRows = [];
      }
    };

    lines.forEach((line, i) => {
      if (!line) {
        flushPrices(`p${i}`);
        return;
      }
      const m = line.match(priceRe);
      if (m) {
        const [, crop, market, price, rest] = m;
        const date = rest.match(/\d{4}-\d{2}-\d{2}/)?.[0];
        priceRows.push(
          <div
            key={`r${i}`}
            dir="auto"
            className="flex items-center justify-between gap-3 rounded-xl border border-[#B7D4C8] bg-[#F3FAF6] px-4 py-3"
          >
            <div className="min-w-0">
              <div className="text-lg font-bold text-agri-900 leading-tight">{crop.trim()}</div>
              <div className="text-sm text-[#4B5563] leading-snug">{market.trim()}</div>
              {date && <div className="text-sm text-[#636E72] mt-0.5">Recorded {date}</div>}
            </div>
            <div className="text-right shrink-0">
              <div className="text-2xl font-extrabold text-agri-900 leading-none">Rs {price}</div>
              <div className="text-sm text-[#636E72]">per kg</div>
            </div>
          </div>
        );
        return;
      }
      flushPrices(`p${i}`);
      if (/^[-•*]\s+/.test(line)) {
        out.push(
          <div key={`b${i}`} dir="auto" className="flex gap-2 text-base leading-relaxed py-0.5">
            <span className="text-agri-900 font-bold">•</span>
            <span>{line.replace(/^[-•*]\s+/, '')}</span>
          </div>
        );
      } else if (noteRe.test(line)) {
        out.push(
          <div key={`n${i}`} dir="auto" className="mt-2 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-sm text-amber-900">
            {line}
          </div>
        );
      } else if (i === 0 || /:$/.test(line)) {
        out.push(
          <div key={`h${i}`} dir="auto" className="text-lg font-bold text-agri-900 mb-1 mt-1">
            {line}
          </div>
        );
      } else {
        out.push(
          <div key={`t${i}`} dir="auto" className="text-base leading-relaxed py-0.5">
            {line}
          </div>
        );
      }
    });
    flushPrices('end');
    return <>{out}</>;
  }

  return (
    <div className="flex flex-col h-full min-h-0 bg-white border border-[#E5E7EB] rounded-2xl shadow-sm overflow-hidden">
      {/* Header */}
      <div className="bg-[#E8F3EE] border-b border-[#B7D4C8] p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-agri-900 text-white flex items-center justify-center">
            <Sparkles className="w-4 h-4" />
          </div>

          <div>
            <h1 className="text-sm font-bold text-agri-900">
              AgriConnect AI
            </h1>

            <p className="text-xs text-agri-900/80">
              English · Urdu · Roman Urdu
            </p>
          </div>
        </div>

        <span className="text-xs bg-white text-agri-900 border border-[#B7D4C8] px-2 py-0.5 rounded-full font-semibold">
          {user.role}
        </span>
      </div>

      {/* Pending actions */}
      {pending.length > 0 && (
        <div className="bg-amber-50 border-b border-amber-200 p-3 space-y-2">
          <div className="text-xs font-bold uppercase tracking-wider text-amber-800">
            Pending Actions
          </div>

          {pending.map((action) => (
            <div
              key={action.id}
              className="flex items-center justify-between gap-3 bg-white border border-amber-200 rounded-lg p-2.5"
            >
              <div className="text-sm text-charcoal min-w-0">
                <span className="font-semibold">
                  {action.actionType.replace(/_/g, ' ')}
                </span>

                <span className="text-[#636E72] ml-1">
                  — {action.humanSummary}
                </span>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={() => handleConfirm(action.id)}
                  disabled={loading}
                  className="flex items-center gap-1 bg-agri-900 hover:bg-agri-800 disabled:opacity-50 text-white text-xs font-semibold px-2 py-1 rounded transition-colors"
                >
                  <CheckCircle2 className="w-3 h-3" />
                  Confirm
                </button>

                <button
                  type="button"
                  onClick={() => handleCancel(action.id)}
                  disabled={loading}
                  className="flex items-center gap-1 bg-white hover:bg-rose-50 text-rose-700 border border-rose-200 disabled:opacity-50 text-xs font-semibold px-2 py-1 rounded transition-colors"
                >
                  <XCircle className="w-3 h-3" />
                  Cancel
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Messages */}
      <div ref={messagesContainerRef} className="flex-1 min-h-0 overflow-y-auto p-4 space-y-4 bg-[#F8F9F5] overscroll-contain">
        {messages.map((message, index) => {
          const isUser = message.role === 'user';

          const Icon = isUser
            ? User
            : toolIcons[message.tool || 'help'] || Bot;

          return (
            <div
              key={index}
              className={`flex gap-2.5 ${
                isUser ? 'flex-row-reverse' : ''
              }`}
            >
              <div
                className={`w-8 h-8 rounded-full shrink-0 flex items-center justify-center ${
                  isUser
                    ? 'bg-[#E5E7EB] text-charcoal'
                    : 'bg-agri-900 text-white'
                }`}
              >
                <Icon className="w-4 h-4" />
              </div>

              <div className="max-w-[88%] space-y-2">
                <div
                  className={`rounded-2xl px-4 py-3 text-base leading-relaxed ${
                    isUser
                      ? 'bg-agri-900 text-white rounded-br-none'
                      : 'bg-white border border-[#E5E7EB] text-charcoal rounded-bl-none shadow-sm'
                  }`}
                >
                  {renderMessage(message.text, isUser)}
                </div>

                {!isUser &&
                  message.actions &&
                  message.actions.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {message.actions.map((action) => (
                        <Link
                          key={`${action.href}-${action.label}`}
                          href={action.href}
                          className="text-xs font-semibold text-agri-900 bg-white border border-[#B7D4C8] hover:bg-[#E8F3EE] rounded-full px-2.5 py-1 transition-colors"
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

        {isListening && (
          <div className="flex gap-2.5">
            <div className="w-8 h-8 rounded-full bg-rose-600 text-white flex items-center justify-center">
              <Mic className="w-4 h-4 animate-pulse" />
            </div>

            <div className="bg-white border border-rose-200 rounded-2xl rounded-bl-none px-4 py-2.5 text-sm text-charcoal">
              <div className="font-semibold text-rose-700">
                {voiceLanguage === 'ur-PK'
                  ? 'Listening... Urdu mein bolain'
                  : 'Listening... Speak in English'}
              </div>

              {interimTranscript && (
                <div className="mt-1 text-[#636E72]">
                  {interimTranscript}
                </div>
              )}
            </div>
          </div>
        )}

        {loading && (
          <div className="flex gap-2.5">
            <div className="w-8 h-8 rounded-full bg-agri-900 text-white flex items-center justify-center">
              <Bot className="w-4 h-4" />
            </div>

            <div className="bg-white border border-[#E5E7EB] rounded-2xl rounded-bl-none px-4 py-2.5 text-sm text-[#636E72] flex items-center gap-2">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              AgriConnect AI is thinking...
            </div>
          </div>
        )}

        {error && (
          <div className="bg-rose-50 border border-rose-200 text-rose-700 text-sm p-3 rounded-lg">
            {error}
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Quick prompts */}
      <div className="bg-white border-t border-[#E5E7EB] px-4 pt-3 pb-1">
        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
          {quickPrompts.map((prompt) => (
            <button
              type="button"
              key={prompt}
              onClick={() => setInput(prompt)}
              className="flex items-center gap-1.5 bg-[#F8F9F5] hover:bg-[#E8F3EE] text-charcoal border border-[#E5E7EB] rounded-full px-3 py-1.5 text-sm font-medium whitespace-nowrap transition-colors"
            >
              <Sparkles className="w-3.5 h-3.5 text-agri-900" />
              {prompt}
            </button>
          ))}
        </div>
      </div>

      {/* Input */}
      <form
        onSubmit={handleSubmit}
        className="p-4 bg-white border-t border-[#E5E7EB]"
      >
        {/* Voice language selector */}
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-[#636E72]">
            Speak in Urdu or English · Roman Urdu can be typed
          </span>

          <div className="flex items-center rounded-lg border border-[#E5E7EB] overflow-hidden">
            <button
              type="button"
              onClick={() => setVoiceLanguage('ur-PK')}
              disabled={isListening}
              className={`px-2.5 py-1 text-xs font-semibold transition-colors ${
                voiceLanguage === 'ur-PK'
                  ? 'bg-agri-900 text-white'
                  : 'bg-white text-[#636E72] hover:bg-[#F8F9F5]'
              }`}
            >
              Urdu
            </button>

            <button
              type="button"
              onClick={() => setVoiceLanguage('en-US')}
              disabled={isListening}
              className={`px-2.5 py-1 text-xs font-semibold transition-colors ${
                voiceLanguage === 'en-US'
                  ? 'bg-agri-900 text-white'
                  : 'bg-white text-[#636E72] hover:bg-[#F8F9F5]'
              }`}
            >
              English
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={startVoiceRecognition}
            disabled={!speechSupported || loading}
            title={
              !speechSupported
                ? 'Voice input is not supported by this browser'
                : isListening
                  ? 'Stop listening'
                  : voiceLanguage === 'ur-PK'
                    ? 'Urdu voice input'
                    : 'English voice input'
            }
            aria-label={
              isListening ? 'Stop voice recognition' : 'Start voice recognition'
            }
            className={`p-2.5 rounded-full border transition-all ${
              isListening
                ? 'bg-rose-600 border-rose-600 text-white shadow-sm'
                : 'bg-[#F8F9F5] hover:bg-[#E8F3EE] text-agri-900 border-[#E5E7EB]'
            } disabled:opacity-40 disabled:cursor-not-allowed`}
          >
            {isListening ? (
              <MicOff className="w-4 h-4" />
            ) : (
              <Mic className="w-4 h-4" />
            )}
          </button>

          <input
            type="text"
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder="Ask in English, Urdu, or Roman Urdu..."
            disabled={loading}
            className="flex-1 bg-[#F8F9F5] border border-[#E5E7EB] rounded-xl px-4 py-3 text-base text-charcoal placeholder:text-[#636E72] focus:outline-none focus:ring-2 focus:ring-agri-900/20 disabled:opacity-60"
          />

          <button
            type="submit"
            disabled={!input.trim() || loading || isListening}
            className="p-2.5 rounded-full bg-agri-900 hover:bg-agri-800 disabled:opacity-50 disabled:cursor-not-allowed text-white transition-colors"
            aria-label="Send message"
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </button>
        </div>

        {!speechSupported && (
          <p className="text-xs text-amber-700 mt-2">
            Voice recognition is unavailable in this browser. Use Chrome or
            Microsoft Edge, or continue by typing.
          </p>
        )}
      </form>
    </div>
  );
}