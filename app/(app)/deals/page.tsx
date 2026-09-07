import Link from 'next/link';
import { Prisma, UserRole } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { requireCapability } from '@/lib/authz';
import {
  Badge,
  Card,
  CropThumb,
  EmptyState,
  PageHeader,
  humanStatus,
  money,
  qty,
  statusTone,
} from '@/components/ui/kit';

export const dynamic = 'force-dynamic';

export default async function DealsPage() {
  const user = await requireCapability('farmer.deals.view', 'arhti.deals.manage');
  const isFarmer = user.role === UserRole.FARMER;

  const deals = await prisma.farmerArhtiDeal.findMany({
    where: isFarmer ? { farmerId: user.id } : { arhtiId: user.id },
    include: {
      crop: true,
      farmer: { select: { name: true } },
      arhti: { select: { name: true } },
      destinationMandi: { select: { name: true, city: true } },
      settlement: true,
      pickup: { select: { driverName: true, scheduledAt: true, confirmedAt: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  const open = deals.filter((d) => d.status !== 'COMPLETED' && d.status !== 'CANCELLED');
  const closed = deals.filter((d) => d.status === 'COMPLETED' || d.status === 'CANCELLED');

  return (
    <div className="max-w-4xl mx-auto">
      <PageHeader
        title={isFarmer ? 'My Deals' : 'Farmer Deals'}
        titleUrdu={isFarmer ? 'میرے سودے' : 'کسان سودے'}
        subtitle={
          isFarmer
            ? 'Every accepted offer becomes a deal. Track pickup, weighing at the mandi and your payment here.'
            : 'Produce you have committed to buy from farmers, from agreement through weighing to payment.'
        }
      />

      {deals.length === 0 ? (
        <EmptyState
          title="No deals yet"
          message={
            isFarmer
              ? 'Accept an arhti offer and the deal will appear here with transport and payment steps.'
              : 'Send a price offer from the Farmer Market and accepted offers will land here.'
          }
          actionHref={isFarmer ? '/arhti-requests' : '/sourcing'}
          actionLabel={isFarmer ? 'See arhti offers' : 'Open Farmer Market'}
        />
      ) : (
        <div className="space-y-6">
          <section>
            <h2 className="text-xs font-bold uppercase tracking-wider text-[#636E72] mb-2">
              In progress ({open.length})
            </h2>
            <div className="space-y-3">
              {open.map((deal) => (
                <DealRow key={deal.id} deal={deal} isFarmer={isFarmer} />
              ))}
              {open.length === 0 && (
                <Card>
                  <p className="text-xs text-[#636E72]">Nothing in progress.</p>
                </Card>
              )}
            </div>
          </section>

          {closed.length > 0 && (
            <section>
              <h2 className="text-xs font-bold uppercase tracking-wider text-[#636E72] mb-2">
                Closed ({closed.length})
              </h2>
              <div className="space-y-3">
                {closed.map((deal) => (
                  <DealRow key={deal.id} deal={deal} isFarmer={isFarmer} />
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}

type DealListItem = Prisma.FarmerArhtiDealGetPayload<{
  include: {
    crop: true;
    farmer: { select: { name: true } };
    arhti: { select: { name: true } };
    destinationMandi: { select: { name: true; city: true } };
    settlement: true;
    pickup: { select: { driverName: true; scheduledAt: true; confirmedAt: true } };
  };
}>;

function DealRow({ deal, isFarmer }: { deal: DealListItem; isFarmer: boolean }) {
  const quantity = deal.receivedQuantityKg ?? deal.agreedQuantityKg;
  return (
    <Link href={`/deals/${deal.id}`} className="block">
      <Card className="hover:border-[#B7D4C8] transition-colors">
        <div className="flex items-start gap-3">
          <CropThumb imageUrl={deal.crop.imageUrl} name={deal.crop.name} size="sm" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-bold text-charcoal">{deal.crop.name}</span>
              <Badge tone={statusTone(deal.status)}>{humanStatus(deal.status)}</Badge>
            </div>
            <div className="text-[11px] text-[#636E72] font-mono mt-0.5">{deal.dealNumber}</div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-2 text-xs">
              <div>
                <div className="text-[10px] text-[#636E72]">{isFarmer ? 'Arhti' : 'Farmer'}</div>
                <div className="font-semibold text-charcoal truncate">
                  {isFarmer ? deal.arhti.name : deal.farmer.name}
                </div>
              </div>
              <div>
                <div className="text-[10px] text-[#636E72]">Quantity</div>
                <div className="font-semibold text-charcoal">{qty(quantity)}</div>
              </div>
              <div>
                <div className="text-[10px] text-[#636E72]">Rate</div>
                <div className="font-semibold text-agri-900">{money(deal.agreedPricePerKg)}/kg</div>
              </div>
              <div>
                <div className="text-[10px] text-[#636E72]">
                  {isFarmer ? 'Net payable' : 'Destination'}
                </div>
                <div className="font-semibold text-charcoal truncate">
                  {isFarmer
                    ? deal.settlement
                      ? money(deal.settlement.netPayable)
                      : 'After weighing'
                    : deal.destinationMandi.city}
                </div>
              </div>
            </div>
          </div>
        </div>
      </Card>
    </Link>
  );
}
