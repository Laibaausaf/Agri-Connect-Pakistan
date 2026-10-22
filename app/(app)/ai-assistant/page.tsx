import { requireCapability } from '@/lib/authz';
import { loadAgentSessions, roleQuickPrompts } from '@/lib/actions/ai';
import AssistantChat from '@/components/ai/AssistantChat';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export default async function AiAssistantPage() {
  const user = await requireCapability('shared.ai');

  const [agentSessions, quickPrompts, crops] = await Promise.all([
    loadAgentSessions(),
    roleQuickPrompts(),
    prisma.crop.findMany({ select: { name: true, nameUrdu: true } }),
  ]);

  // Urdu crop names for pending-action summaries in Urdu mode.
  const cropNamesUrdu = Object.fromEntries(
    crops.filter((crop) => crop.nameUrdu).map((crop) => [crop.name, crop.nameUrdu as string])
  );
  const latestSession = agentSessions[0];

  const history: { role: 'user' | 'ai'; text: string; tool?: string }[] = [];
  if (latestSession?.context && typeof latestSession.context === 'object') {
    const ctx = latestSession.context as {
      history?: { role: 'user' | 'ai'; text: string; tool?: string }[];
    };
    if (Array.isArray(ctx.history)) history.push(...ctx.history);
  }

  const pendingActions = agentSessions
    .flatMap((s) => s.actions)
    .filter((a) => a.status === 'PENDING');

  return (
    <div className="max-w-3xl mx-auto h-[calc(100vh-8rem)] flex flex-col">
      <AssistantChat
        user={{ id: user.id, name: user.name, role: user.role }}
        initialSessionId={latestSession?.id}
        initialHistory={history}
        pendingActions={pendingActions}
        quickPrompts={quickPrompts}
        cropNamesUrdu={cropNamesUrdu}
      />
    </div>
  );
}
