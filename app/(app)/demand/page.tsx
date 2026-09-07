import Link from 'next/link';
import { DemandStatus } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { requireCapability } from '@/lib/authz';
import { closeDemandRequest } from '@/lib/actions/sourcing';
import ActionForm from '@/components/ui/ActionForm';
import {
  Badge,
  Card,
  CropThumb,
  EmptyState,
  PageHeader,
  StatCard,
  money,
  qty,
} from '@/components/ui/kit';

export const dynamic = 'force-dynamic';

function origins(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((v): v is string => typeof v === 'string');
  return [];
}

export default async function DemandPage() {
  const user = await requireCapability('arhti.demand.manage');

  const requests = await prisma.arhtiDemandRequest.findMany({
    where: { arhtiId: user.id },
    include: { crop: true, mandi: { select: { name: true, city: true } } },
    orderBy: { createdAt: 'desc' },
  });

  const open = requests.filter((r) => r.status === DemandStatus.OPEN);
  const closed = requests.filter((r) => r.status !== DemandStatus.OPEN);
  const openVolume = open.reduce((sum, r) => sum + r.maxQuantityKg, 0);

  return (
    <div className="max-w-4xl mx-auto">
      <PageHeader
        title="Buy Requests"
        titleUrdu="خرید کی درخواستیں"
        subtitle="Tell farmers what you want to buy this week. Farmers see open requests and bring matching produce to you."
        action={
          <Link
            href="/demand/new"
            className="px-3 py-2 text-[11px] font-semibold rounded-xl bg-agri-900 text-white whitespace-nowrap"
          >
            Post request
          </Link>
        }
      />

      <div className="grid grid-cols-3 gap-3 mb-4">
        <StatCard label="Open requests" value={String(open.length)} tone="accent" />
        <StatCard label="Volume wanted" value={qty(openVolume)} />
        <StatCard label="Closed" value={String(closed.length)} />
      </div>

      {requests.length === 0 ? (
        <EmptyState
          title="No buy requests yet"
          message="Post what you need this week — crop, quantity, grade and the rate band you can pay."
          actionHref="/demand/new"
          actionLabel="Post your first request"
        />
      ) : (
        <div className="space-y-3">
          {[...open, ...closed].map((request) => (
            <Card key={request.id}>
              <div className="flex items-start gap-3">
                <CropThumb imageUrl={request.crop.imageUrl} name={request.crop.name} size="sm" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-bold text-charcoal">{request.crop.name}</span>
                    <Badge tone={request.status === DemandStatus.OPEN ? 'green' : 'neutral'}>
                      {request.status === DemandStatus.OPEN ? 'Open' : 'Closed'}
                    </Badge>
                    {request.transportOffered && <Badge tone="neutral">Transport offered</Badge>}
                  </div>
                  <div className="text-[11px] text-[#636E72] font-mono mt-0.5">
                    {request.requestNumber}
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-2 text-xs">
                    <div>
                      <div className="text-[10px] text-[#636E72]">Quantity</div>
                      <div className="font-semibold text-charcoal">
                        {qty(request.minQuantityKg)} – {qty(request.maxQuantityKg)}
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] text-[#636E72]">Rate band</div>
                      <div className="font-semibold text-agri-900">
                        {request.targetPriceMin && request.targetPriceMax
                          ? `${money(request.targetPriceMin)}–${money(request.targetPriceMax)}`
                          : 'Open'}
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] text-[#636E72]">Needed by</div>
                      <div className="font-semibold text-charcoal">
                        {request.neededBy.toLocaleDateString('en-PK', {
                          day: 'numeric',
                          month: 'short',
                        })}
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] text-[#636E72]">Deliver to</div>
                      <div className="font-semibold text-charcoal truncate">
                        {request.mandi.city}
                      </div>
                    </div>
                  </div>
                  {origins(request.preferredOrigins).length > 0 && (
                    <div className="text-[11px] text-[#636E72] mt-2">
                      Preferred origins: {origins(request.preferredOrigins).join(', ')}
                    </div>
                  )}
                  {request.gradeWanted && (
                    <div className="text-[11px] text-[#636E72]">Grade: {request.gradeWanted}</div>
                  )}
                  {request.notes && (
                    <p className="text-[11px] text-[#636E72] mt-1">{request.notes}</p>
                  )}
                  {request.status === DemandStatus.OPEN && (
                    <ActionForm
                      action={closeDemandRequest}
                      submitLabel="Close request"
                      variant="inline"
                      hidden={{ requestId: request.id }}
                      className="inline-block"
                    />
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
