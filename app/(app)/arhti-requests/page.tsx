import Link from 'next/link';
import { DemandStatus, OfferDirection, OfferStatus } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { requireCapability } from '@/lib/authz';
import { respondToOffer } from '@/lib/actions/sourcing';
import { getI18n } from '@/lib/i18n/server';
import ActionForm from '@/components/ui/ActionForm';
import {
  Badge,
  Card,
  CropThumb,
  EmptyState,
  PageHeader,
  statusTone,
} from '@/components/ui/kit';

export const dynamic = 'force-dynamic';

export default async function ArhtiRequestsPage() {
  const user = await requireCapability('farmer.offers.respond');
  const { t, crop, place, status, grade, kg, perKg, money, date } = await getI18n();

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
      <PageHeader title={t('offers.title')} subtitle={t('offers.subtitle')} />

      <h2 className="text-base font-bold text-charcoal mb-1">{t('offers.waiting')}</h2>
      {pendingOffers.length === 0 ? (
        <EmptyState
          title={t('offers.emptyTitle')}
          message={t('offers.emptyMessage')}
          actionHref="/crops/new"
          actionLabel={t('offers.emptyAction')}
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
                      {offer.pricePerKg === best && <Badge tone="green">{t('offers.bestRate')}</Badge>}
                      <Badge>{crop(offer.batch.crop)}</Badge>
                    </div>
                    <div className="text-[11px] text-[#636E72] mt-0.5">
                      {t('offers.wants', {
                        place: offer.arhti.location ? place(offer.arhti.location) : t('offers.arhti'),
                        qty: kg(offer.quantityKg),
                        batch: offer.batch.batchNumber,
                      })}
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3 text-xs">
                      <div>
                        <div className="text-[10px] text-[#636E72]">{t('offers.rate')}</div>
                        <div className="font-bold text-agri-900">{perKg(offer.pricePerKg)}</div>
                      </div>
                      <div>
                        <div className="text-[10px] text-[#636E72]">{t('offers.youReceive')}</div>
                        <div className="font-semibold text-charcoal">{money(total)}</div>
                      </div>
                      <div>
                        <div className="text-[10px] text-[#636E72]">{t('offers.destination')}</div>
                        <div className="font-semibold text-charcoal truncate">
                          {place(offer.destinationMandi.city)}
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] text-[#636E72]">{t('offers.transport')}</div>
                        <div className="font-semibold text-charcoal">
                          {offer.transportResponsibility === 'ARHTI'
                            ? t('offers.transportArhti')
                            : offer.transportResponsibility === 'FARMER'
                              ? t('offers.transportFarmer')
                              : t('offers.transportShared')}
                        </div>
                      </div>
                    </div>

                    {/* The arhti's note is typed text and shown as written. */}
                    {offer.note && (
                      <p className="text-[11px] text-[#636E72] mt-2 bg-[#F8F9F5] border border-[#E5E7EB] rounded-lg p-2">
                        {offer.note}
                      </p>
                    )}

                    <div className="flex items-center gap-2 mt-3">
                      <ActionForm
                        action={respondToOffer}
                        hidden={{ offerId: offer.id, decision: 'ACCEPT' }}
                        submitLabel={t('offers.accept')}
                        variant="inline"
                      />
                      <ActionForm
                        action={respondToOffer}
                        hidden={{ offerId: offer.id, decision: 'REJECT' }}
                        submitLabel={t('offers.decline')}
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
        <summary className="cursor-pointer text-sm font-bold text-charcoal">{t('offers.demandTitle')}</summary>
        <div className="pt-3">
      {openDemand.length === 0 ? (
        <Card>
          <p className="text-xs text-[#636E72]">{t('offers.noDemand')}</p>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {openDemand.map((req) => (
            <Card key={req.id}>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-semibold text-charcoal">{crop(req.crop)}</span>
                <Badge tone="green">{place(req.mandi.city)}</Badge>
              </div>
              <div className="text-[11px] text-[#636E72] mt-1">{req.arhti.name}</div>
              <div className="text-xs text-charcoal mt-2">
                {t('offers.demandWants', { min: kg(req.minQuantityKg), max: kg(req.maxQuantityKg) })}
                {req.gradeWanted ? ` • ${grade(req.gradeWanted)}` : ''}
              </div>
              <div className="text-xs text-agri-900 font-semibold mt-1">
                {req.targetPriceMin && req.targetPriceMax
                  ? t('offers.rateRange', { min: perKg(req.targetPriceMin), max: perKg(req.targetPriceMax) })
                  : t('offers.rateOnDiscussion')}
              </div>
              <div className="text-[10px] text-[#636E72] mt-1">
                {t('offers.neededBy', { date: date(req.neededBy) })}
                {req.transportOffered ? ` • ${t('offers.arhtiTransport')}` : ''}
              </div>
            </Card>
          ))}
        </div>
      )}

      {answeredOffers.length > 0 && (
        <>
          <h2 className="text-xs font-bold uppercase tracking-wider text-[#636E72] mt-8 mb-2">
            {t('offers.history')}
          </h2>
          <Card padded={false}>
            <div className="divide-y divide-[#E5E7EB]">
              {answeredOffers.map((offer) => (
                <div key={offer.id} className="flex items-center justify-between gap-3 px-4 py-3 text-xs">
                  <div className="min-w-0">
                    <div className="font-semibold text-charcoal truncate">
                      {crop(offer.batch.crop)} • {offer.arhti.name}
                    </div>
                    <div className="text-[10px] text-[#636E72]">
                      {t('offers.qtyAt', { qty: kg(offer.quantityKg), rate: perKg(offer.pricePerKg) })}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Badge tone={statusTone(offer.status)}>{status(offer.status)}</Badge>
                    {offer.deal && (
                      <Link href={`/deals/${offer.deal.id}`} className="text-agri-900 hover:underline">
                        {t('offers.viewDeal')}
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
