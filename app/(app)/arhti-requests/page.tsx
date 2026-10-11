import Link from 'next/link';
import { DemandStatus, OfferDirection, OfferStatus } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { requireCapability } from '@/lib/authz';
import { respondToOffer } from '@/lib/actions/sourcing';
import ActionForm from '@/components/ui/ActionForm';
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

export default async function ArhtiRequestsPage() {
  const user = await requireCapability('farmer.offers.respond');

  const [pendingOffers, answeredOffers, openDemand] = await Promise.all([
    prisma.farmerArhtiOffer.findMany({
      where: {
        farmerId: user.id,
        direction: OfferDirection.ARHTI_TO_FARMER,
        status: OfferStatus.PENDING,
      },
      include: {
        arhti: { select: { id: true, name: true, location: true } },
        batch: { include: { crop: true } },
        destinationMandi: true,
      },
      orderBy: { pricePerKg: 'desc' },
    }),
    prisma.farmerArhtiOffer.findMany({
      where: { farmerId: user.id, status: { not: OfferStatus.PENDING } },
      include: { arhti: { select: { name: true } }, batch: { include: { crop: true } }, deal: true },
      orderBy: { respondedAt: 'desc' },
      take: 8,
    }),
    prisma.arhtiDemandRequest.findMany({
      where: { status: DemandStatus.OPEN },
      include: { arhti: { select: { name: true } }, crop: true, mandi: true },
      orderBy: { neededBy: 'asc' },
      take: 6,
    }),
  ]);

  const best = pendingOffers[0]?.pricePerKg;

  return (
    <div className="max-w-4xl mx-auto">
      <PageHeader
        title="Arhti Requests"
        titleUrdu="آڑھتی کی طلب"
        subtitle="Review a price, then accept or decline. آفر دیکھیں، پھر منظور یا انکار کریں۔"
      />

      <h2 className="text-base font-bold text-charcoal mb-1">
        Offers waiting for your answer <span className="font-normal text-sm text-[#636E72]">(جواب دینا ہے)</span>
      </h2>
      {pendingOffers.length === 0 ? (
        <EmptyState
          title="No offers right now"
          message="Once you add a crop batch, arhtis in nearby mandis can send you a rate. You will get a notification."
          actionHref="/crops/new"
          actionLabel="Add a crop batch"
        />
      ) : (
        <div className="space-y-3">
          {pendingOffers.map((offer) => {
            const total = offer.quantityKg * offer.pricePerKg;
            return (
              <Card key={offer.id}>
                <div className="flex items-start gap-3">
                  <CropThumb imageUrl={offer.batch.crop.imageUrl} name={offer.batch.crop.name} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-bold text-charcoal">{offer.arhti.name}</span>
                      {offer.pricePerKg === best && <Badge tone="green">Best rate</Badge>}
                      <Badge>{offer.batch.crop.name}</Badge>
                    </div>
                    <div className="text-[11px] text-[#636E72] mt-0.5">
                      {offer.arhti.location ?? 'Arhti'} • wants {qty(offer.quantityKg)} of{' '}
                      {offer.batch.batchNumber}
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3 text-xs">
                      <div>
                        <div className="text-[10px] text-[#636E72]">Rate</div>
                        <div className="font-bold text-agri-900">{money(offer.pricePerKg)}/kg</div>
                      </div>
                      <div>
                        <div className="text-[10px] text-[#636E72]">You receive</div>
                        <div className="font-semibold text-charcoal">{money(total)}</div>
                      </div>
                      <div>
                        <div className="text-[10px] text-[#636E72]">Destination</div>
                        <div className="font-semibold text-charcoal truncate">
                          {offer.destinationMandi.city}
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] text-[#636E72]">Transport</div>
                        <div className="font-semibold text-charcoal">
                          {offer.transportResponsibility === 'ARHTI'
                            ? 'Arhti arranges'
                            : offer.transportResponsibility === 'FARMER'
                              ? 'You arrange'
                              : 'Shared'}
                        </div>
                      </div>
                    </div>

                    {offer.note && (
                      <p className="text-[11px] text-[#636E72] mt-2 bg-[#F8F9F5] border border-[#E5E7EB] rounded-lg p-2">
                        {offer.note}
                      </p>
                    )}

                    <div className="flex items-center gap-2 mt-3">
                      <ActionForm
                        action={respondToOffer}
                        hidden={{ offerId: offer.id, decision: 'ACCEPT' }}
                        submitLabel="Accept"
                        submitLabelUrdu="منظور"
                        variant="inline"
                      />
                      <ActionForm
                        action={respondToOffer}
                        hidden={{ offerId: offer.id, decision: 'REJECT' }}
                        submitLabel="Decline"
                        variant="secondary"
                        className="inline-block"
                      />
                    </div>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <details className="mt-6 rounded-xl border border-[#E5E7EB] bg-white p-3">
        <summary className="cursor-pointer text-sm font-bold text-charcoal">What arhtis need this week <span className="font-normal text-[#636E72]">(اس ہفتے آڑھتیوں کو کیا چاہیے)</span></summary>
        <div className="pt-3">
      {openDemand.length === 0 ? (
        <Card>
          <p className="text-xs text-[#636E72]">No open buy requests at the moment.</p>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {openDemand.map((req) => (
            <Card key={req.id}>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-semibold text-charcoal">{req.crop.name}</span>
                <Badge tone="green">{req.mandi.city}</Badge>
              </div>
              <div className="text-[11px] text-[#636E72] mt-1">{req.arhti.name}</div>
              <div className="text-xs text-charcoal mt-2">
                Wants {qty(req.minQuantityKg)} – {qty(req.maxQuantityKg)}
                {req.gradeWanted ? ` • ${req.gradeWanted}` : ''}
              </div>
              <div className="text-xs text-agri-900 font-semibold mt-1">
                {req.targetPriceMin && req.targetPriceMax
                  ? `${money(req.targetPriceMin)} – ${money(req.targetPriceMax)}/kg`
                  : 'Rate on discussion'}
              </div>
              <div className="text-[10px] text-[#636E72] mt-1">
                Needed by {req.neededBy.toLocaleDateString('en-PK')}
                {req.transportOffered ? ' • transport arranged by arhti' : ''}
              </div>
            </Card>
          ))}
        </div>
      )}

      {answeredOffers.length > 0 && (
        <>
          <h2 className="text-xs font-bold uppercase tracking-wider text-[#636E72] mt-8 mb-2">
            Offer history
          </h2>
          <Card padded={false}>
            <div className="divide-y divide-[#E5E7EB]">
              {answeredOffers.map((offer) => (
                <div key={offer.id} className="flex items-center justify-between gap-3 px-4 py-3 text-xs">
                  <div className="min-w-0">
                    <div className="font-semibold text-charcoal truncate">
                      {offer.batch.crop.name} • {offer.arhti.name}
                    </div>
                    <div className="text-[10px] text-[#636E72]">
                      {qty(offer.quantityKg)} at {money(offer.pricePerKg)}/kg
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Badge tone={statusTone(offer.status)}>{humanStatus(offer.status)}</Badge>
                    {offer.deal && (
                      <Link href={`/deals/${offer.deal.id}`} className="text-agri-900 hover:underline">
                        View deal
                      </Link>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </>
      )}
        </div>
      </details>
    </div>
  );
}
