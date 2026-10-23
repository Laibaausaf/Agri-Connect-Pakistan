'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {askAi, confirmAgentAction, cancelAgentAction,} from '@/lib/actions/natural-ai';
import { UserRole } from '@prisma/client';
import { useI18n } from '@/components/i18n/LanguageProvider';
import Icon, { type IconName } from '@/components/ui/Icon';

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

const toolIcons: Record<string, IconName> = {
  prices: 'trendup',
  myCrops: 'sprout',
  myOffers: 'handshake',
  myDeals: 'truck',
  myPayments: 'wallet',
  sourcing: 'sprout',
  receiving: 'scale',
  arhtiInventory: 'warehouse',
  arhtiAuctions: 'gavel',
  arhtiSales: 'banknote',
  vendorAuctions: 'gavel',
  vendorStock: 'warehouse',
  vendorWholesale: 'store',
  shopWholesale: 'store',
  shopStock: 'package',
  shopOrders: 'cart',
  adminChain: 'route',
  help: 'sparkles',
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
  cropNamesUrdu,
}: {
  user: UserSummary;
  initialSessionId?: string;
  initialHistory: ChatMessage[];
  pendingActions: PendingAction[];
  quickPrompts: string[];
  cropNamesUrdu: Record<string, string>;
}) {
  const router = useRouter();
  const i18n = useI18n();
  const { t } = i18n;

  const [sessionId, setSessionId] = useState(initialSessionId);

  const [messages, setMessages] = useState<ChatMessage[]>(initialHistory);

  // The greeting is UI text (not an AI reply), so it follows the language
  // toggle; it is shown first while the chat has no history.
  const greeting: ChatMessage = {
    role: 'ai',
    text: t('chat.welcome', {
      name: user.name,
      role: i18n.isUrdu ? i18n.role(user.role) : user.role.toLowerCase(),
    }),
    tool: 'help',
  };
  const shownMessages = initialHistory.length ? messages : [greeting, ...messages];

  const actionLabel = (actionType: string) =>
    i18n.isUrdu && (actionType === 'CREATE_CROP_BATCH' || actionType === 'OPEN_CROP_BATCH_FORM')
      ? t(`chat.action.${actionType}`)
      : actionType.replace(/_/g, ' ');

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
        setError(i18n.error(result.error));
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

        /*
         * The farmer assistant may replace an earlier crop listing or
         * return one that is already shown, so drop superseded actions
         * and never list the same action twice.
         */
        const superseded =
          'supersededActionIds' in result
            ? result.supersededActionIds
            : [];

        if (superseded.length) {
          setPending((previous) =>
            previous.filter((action) => !superseded.includes(action.id))
          );
        }

        if (result.pendingActionId) {
          setPending((previous) =>
            previous.some((action) => action.id === result.pendingActionId)
              ? previous
              : [
                  ...previous,
                  {
                    id: result.pendingActionId!,
                    actionType: result.pendingActionType ?? result.tool,
                    humanSummary:
                      result.pendingActionSummary ?? t('chat.reviewAction'),
                  },
                ]
          );
        }
      }
    } catch (requestError) {
      console.error('AgriConnect AI request failed:', requestError);

      setError(
        t('chat.errRequest')
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
        t('chat.errVoiceUnsupported')
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
            t('chat.errMicBlocked')
          );

          return;
        }

        if (event.error === 'no-speech') {
          setError(
            voiceLanguage === 'ur-PK'
              ? t('chat.errNoSpeechUrdu')
              : t('chat.errNoSpeechEnglish')
          );

          return;
        }

        if (event.error === 'audio-capture') {
          setError(
            t('chat.errNoMic')
          );

          return;
        }

        if (event.error === 'network') {
          setError(
            t('chat.errNetwork')
          );

          return;
        }

        setError(
          t('chat.errVoiceFailed', { detail: event.error ? ` (${event.error})` : '' })
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
        t('chat.errMicStart')
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
        setError(i18n.error(result.error));
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
      setError(i18n.error(result.error));
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
      return <span className="block text-[15px]">{text}</span>;
    }

    const priceRe = /^(.*?)\s*[·:-]\s*(.*?):\s*Rs\.?\s*([\d,]+(?:\.\d+)?)\s*\/\s*(?:kg|کلو)\s*(.*)$/i;
    const noteRe = /^(use these only|note:|یہ |نوٹ)/i;
    const out: React.ReactNode[] = [];
    let priceRows: React.ReactNode[] = [];

    const flushPrices = (key: string) => {
      if (priceRows.length) {
        out.push(
          <div key={key} className="my-2 divide-y divide-line overflow-hidden rounded-2xl bg-paper">
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
          <div key={`r${i}`} dir="auto" className="flex items-center justify-between gap-3 px-4 py-3">
            <div className="min-w-0">
              <div className="text-base font-bold leading-tight">{crop.trim()}</div>
              <div className="text-[13px] leading-snug text-muted">{market.trim()}</div>
              {date && <div className="mt-0.5 text-[13px] text-muted">{t('chat.priceRecorded', { date })}</div>}
            </div>
            <div className="shrink-0 text-end">
              <div className="tabular text-xl font-extrabold leading-none">{t('chat.priceAmount', { price })}</div>
              <div className="text-[13px] text-muted">{t('chat.pricePerKg')}</div>
            </div>
          </div>
        );
        return;
      }
      flushPrices(`p${i}`);
      if (/^[-•*]\s+/.test(line)) {
        out.push(
          <div key={`b${i}`} dir="auto" className="flex gap-2 py-0.5 text-[15px] leading-relaxed">
            <span className="font-bold text-goldtext">•</span>
            <span>{line.replace(/^[-•*]\s+/, '')}</span>
          </div>
        );
      } else if (noteRe.test(line)) {
        out.push(
          <div key={`n${i}`} dir="auto" className="mt-2 flex gap-2 rounded-xl bg-warn-bg px-3 py-2 text-sm text-warn-fg">
            <Icon name="info" size={16} className="mt-0.5" />
            <span>{line}</span>
          </div>
        );
      } else if ((i === 0 && user.role !== 'FARMER') || /:$/.test(line)) {
        // Farmer replies are short conversational answers, so their first
        // line is not automatically a heading; other roles keep it.
        out.push(
          <div key={`h${i}`} dir="auto" className="mb-1 mt-1 text-base font-bold">
            {line}
          </div>
        );
      } else {
        out.push(
          <div key={`t${i}`} dir="auto" className="py-0.5 text-[15px] leading-relaxed">
            {line}
          </div>
        );
      }
    });
    flushPrices('end');
    return <>{out}</>;
  }

  return (
    <div className="card flex h-full min-h-0 flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-line px-4 py-3">
        <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand text-[#F6C871]">
          <Icon name="sparkles" size={22} />
        </span>
        <div className="min-w-0 flex-1">
          <h1 className="text-[17px] font-bold leading-tight">{t('chat.title')}</h1>
          <p className="text-[13px] text-muted">{t('chat.languages')}</p>
        </div>
        <span className="inline-flex h-7 shrink-0 items-center gap-1 rounded-full bg-sage px-2.5 text-[12.5px] font-bold">
          <Icon name="user" size={14} />
          {i18n.role(user.role)}
        </span>
      </div>

      {/* Pending actions */}
      {pending.length > 0 && (
        <div className="space-y-2 border-b border-line bg-warn-bg p-3">
          <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-[.08em] text-warn-fg">
            <Icon name="clock" size={14} />
            {t('chat.pendingActions')}
          </div>

          {pending.map((action) => (
            <div key={action.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-sf p-3">
              <div className="min-w-0 text-sm">
                <span className="font-bold">{actionLabel(action.actionType)}</span>
                <span className="ms-1 text-muted">— {i18n.chatAction(action.humanSummary, cropNamesUrdu)}</span>
              </div>

              <div className="flex shrink-0 items-center gap-2">
                <button type="button" onClick={() => handleCancel(action.id)} disabled={loading} className="btn btn-outline btn-sm text-err-fg">
                  <Icon name="xcircle" size={16} />
                  {t('chat.cancel')}
                </button>
                <button type="button" onClick={() => handleConfirm(action.id)} disabled={loading} className="btn btn-primary btn-sm min-h-10">
                  <Icon name="checkcircle" size={16} />
                  {t('chat.confirm')}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Messages */}
      <div ref={messagesContainerRef} className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain bg-paper p-4">
        {shownMessages.map((message, index) => {
          const isUser = message.role === 'user';
          const icon: IconName = isUser ? 'user' : toolIcons[message.tool || 'help'] || 'sparkles';

          return (
            <div key={index} className={`flex gap-2.5 ${isUser ? 'flex-row-reverse' : ''}`}>
              {!isUser && (
                <span className="mt-1 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-sage text-forest">
                  <Icon name={icon} size={16} />
                </span>
              )}

              <div className={`space-y-2 ${isUser ? 'max-w-[80%]' : 'max-w-[90%] flex-1 sm:flex-none'}`}>
                <div
                  className={`px-4 py-3 ${
                    isUser
                      ? 'rounded-[18px] rounded-ee-md bg-forest text-paper'
                      : 'rounded-[20px] rounded-es-md border border-line bg-sf text-ink shadow-card'
                  }`}
                >
                  {renderMessage(message.text, isUser)}
                </div>

                {!isUser && message.actions && message.actions.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {message.actions.map((action, actionIndex) => (
                      <Link
                        key={`${action.href}-${action.label}`}
                        href={action.href}
                        className={`btn btn-sm ${actionIndex === 0 ? 'btn-primary min-h-10' : 'btn-outline'}`}
                      >
                        <Icon name="arrowright" size={16} />
                        {i18n.nav(action.label, user.role)}
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
            <span className="ac-pulse inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gold text-ongold">
              <Icon name="mic" size={16} />
            </span>
            <div className="rounded-[20px] rounded-es-md border-[1.5px] border-gold bg-sf px-4 py-2.5 text-sm">
              <div className="font-bold text-goldtext">
                {voiceLanguage === 'ur-PK' ? t('chat.listeningUrdu') : t('chat.listeningEnglish')}
              </div>
              {interimTranscript && <div className="mt-1 text-muted">{interimTranscript}</div>}
            </div>
          </div>
        )}

        {loading && (
          <div className="flex items-center gap-2.5 text-sm text-muted">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-sage text-forest">
              <Icon name="sparkles" size={16} />
            </span>
            <span className="inline-flex gap-1" aria-hidden="true">
              <span className="h-2 w-2 animate-bounce rounded-full bg-muted [animation-delay:-0.2s]" />
              <span className="h-2 w-2 animate-bounce rounded-full bg-muted [animation-delay:-0.1s]" />
              <span className="h-2 w-2 animate-bounce rounded-full bg-muted" />
            </span>
            {t('chat.thinking')}
          </div>
        )}

        {error && (
          <div role="alert" className="flex items-start gap-2 rounded-2xl bg-err-bg p-3 text-sm font-semibold text-err-fg">
            <Icon name="alert" size={18} className="mt-0.5" />
            {error}
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Quick prompts */}
      <div className="border-t border-line bg-sf px-3 pt-3">
        <div className="scrollbar-hide flex gap-2 overflow-x-auto pb-3">
          {quickPrompts.map((prompt) => (
            <button
              type="button"
              key={prompt}
              onClick={() => setInput(i18n.quickPrompt(prompt))}
              className="ac-press inline-flex h-11 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border border-line bg-paper px-3.5 text-sm font-semibold hover:border-forest"
            >
              <Icon name="tag" size={15} className="text-forest" />
              {i18n.quickPrompt(prompt)}
            </button>
          ))}
        </div>
      </div>

      {/* Voice and text input */}
      <form onSubmit={handleSubmit} className="border-t border-line bg-sf p-3 sm:p-4">
        <div className="mb-3 flex items-center gap-3">
          <button
            type="button"
            onClick={startVoiceRecognition}
            disabled={!speechSupported || loading}
            title={
              !speechSupported
                ? t('chat.micUnsupportedTitle')
                : isListening
                  ? t('chat.micStop')
                  : voiceLanguage === 'ur-PK'
                    ? t('chat.micUrdu')
                    : t('chat.micEnglish')
            }
            aria-label={isListening ? t('chat.micStopAria') : t('chat.micStartAria')}
            className={`ac-press inline-flex h-14 w-14 shrink-0 items-center justify-center rounded-full disabled:cursor-not-allowed disabled:opacity-40 ${
              isListening ? 'ac-pulse bg-err-fg text-white' : 'bg-gold text-ongold'
            }`}
          >
            <Icon name={isListening ? 'pause' : 'mic'} size={26} stroke={2.3} />
          </button>
          <div className="min-w-0 flex-1">
            <div className="text-[15px] font-bold">{isListening ? t('chat.micStop') : t('chat.tapToSpeak')}</div>
            <div className="text-[13px] text-muted">{t('chat.voiceHint')}</div>
          </div>
          {/* Language the microphone listens for */}
          <div className="flex shrink-0 flex-col overflow-hidden rounded-xl border border-line sm:flex-row" role="group" aria-label={t('header.languageLabel')}>
            <button
              type="button"
              onClick={() => setVoiceLanguage('ur-PK')}
              disabled={isListening}
              aria-pressed={voiceLanguage === 'ur-PK'}
              className={`h-9 px-2.5 text-xs font-bold ${voiceLanguage === 'ur-PK' ? 'bg-forest text-paper' : 'bg-sf text-muted hover:bg-sage'}`}
            >
              {t('chat.voiceUrdu')}
            </button>
            <button
              type="button"
              onClick={() => setVoiceLanguage('en-US')}
              disabled={isListening}
              aria-pressed={voiceLanguage === 'en-US'}
              className={`h-9 px-2.5 text-xs font-bold ${voiceLanguage === 'en-US' ? 'bg-forest text-paper' : 'bg-sf text-muted hover:bg-sage'}`}
            >
              {t('chat.voiceEnglish')}
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <input
            type="text"
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder={t('chat.placeholder')}
            disabled={loading}
            className="field-input flex-1 bg-paper disabled:opacity-60"
          />
          <button
            type="submit"
            disabled={!input.trim() || loading || isListening}
            className="btn shrink-0 bg-forest px-4 text-paper disabled:opacity-50"
            aria-label={t('chat.send')}
          >
            <Icon name={loading ? 'refresh' : 'send'} size={20} className={loading ? 'animate-spin' : ''} />
            <span className="hidden sm:inline">{t('chat.send')}</span>
          </button>
        </div>

        {!speechSupported && <p className="mt-2 text-[13px] text-warn-fg">{t('chat.voiceUnavailable')}</p>}
      </form>
    </div>
  );
}
