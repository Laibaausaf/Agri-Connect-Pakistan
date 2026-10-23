import Link from 'next/link';
import { DemandStatus, OfferDirection, OfferStatus } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { requireCapability } from '@/lib/authz';
import { respondToOffer } from '@/lib/actions/sourcing';
import { getI18n } from '@/lib/i18n/server';
import ActionForm from '@/components/ui/ActionForm';
import Icon from '@/components/ui/Icon';
import { initialsOf } from '@/lib/initials';
import {
  Badge,
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
    <div className="mx-auto max-w-3xl">
      <PageHeader title={t('offers.title')} subtitle={t('offers.subtitle')} />

      <h2 className="mb-3 flex items-center gap-2 text-lg font-bold">
        {t('offers.waiting')}
        {pendingOffers.length > 0 && <Badge tone="amber">{pendingOffers.length}</Badge>}
      </h2>
      {pendingOffers.length === 0 ? (
        <EmptyState
          title={t('offers.emptyTitle')}
          message={t('offers.emptyMessage')}
          actionHref="/crops/new"
          actionLabel={t('offers.emptyAction')}
        />
      ) : (
        <div className="space-y-4">
          {pendingOffers.map((offer) => {
            const total = offer.quantityKg * offer.pricePerKg;
            const isBest = offer.pricePerKg === best;
            return (
              <article key={offer.id} className={`card ac-up p-4 sm:p-5 ${isBest ? 'border-[1.5px] border-gold' : ''}`}>
                <div className="flex items-start gap-3">
                  <span className="h-11 w-11 shrink-0 rounded-xl bg-sage text-center text-sm font-extrabold leading-[44px] text-forest" dir="ltr">
                    {initialsOf(offer.arhti.name)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="text-[17px] font-bold">{offer.arhti.name}</div>
                    <div className="flex items-center gap-1 text-[13px] text-muted">
                      <Icon name="pin" size={14} />
                      {offer.arhti.location ? place(offer.arhti.location) : t('offers.arhti')}
                    </div>
                  </div>
                  {isBest && (
                    <span className="inline-flex h-7 shrink-0 items-center gap-1 rounded-full bg-gold px-2.5 text-[12.5px] font-extrabold text-ongold">
                      <Icon name="star" size={14} />
                      {t('offers.bestRate')}
                    </span>
                  )}
                </div>

                <div className="mt-4 flex items-end justify-between gap-3 rounded-2xl bg-paper p-4">
                  <div>
                    <div className="text-[13px] font-semibold text-muted">{t('offers.rate')}</div>
                    <div className="tabular text-[28px] font-extrabold leading-none">{perKg(offer.pricePerKg)}</div>
                  </div>
                  <div className="text-end">
                    <div className="text-[13px] font-semibold text-muted">{t('offers.youReceive')}</div>
                    <div className="tabular text-[22px] font-extrabold leading-tight text-goldtext">{money(total)}</div>
                  </div>
                </div>

                <dl className="mt-3 grid grid-cols-3 gap-3 text-sm">
                  <div>
                    <dt className="flex items-center gap-1 text-[13px] text-muted">
                      <Icon name="scale" size={14} />
                      {t('deals.quantity')}
                    </dt>
                    <dd className="font-bold">{kg(offer.quantityKg)}</dd>
                  </div>
                  <div className="min-w-0">
                    <dt className="flex items-center gap-1 text-[13px] text-muted">
                      <Icon name="flag" size={14} />
                      {t('offers.destination')}
                    </dt>
                    <dd className="truncate font-bold">{place(offer.destinationMandi.city)}</dd>
                  </div>
                  <div>
                    <dt className="flex items-center gap-1 text-[13px] text-muted">
                      <Icon name="truck" size={14} />
                      {t('offers.transport')}
                    </dt>
                    <dd className="font-bold">
                      {offer.transportResponsibility === 'ARHTI'
                        ? t('offers.transportArhti')
                        : offer.transportResponsibility === 'FARMER'
                          ? t('offers.transportFarmer')
                          : t('offers.transportShared')}
                    </dd>
                  </div>
                </dl>

                {/* The arhti's note is typed text and shown as written. */}
                {offer.note && (
                  <p className="mt-3 flex gap-2 text-sm text-ink">
                    <Icon name="message" size={16} className="mt-0.5 text-muted" />
                    <span dir="auto">“{offer.note}”</span>
                  </p>
                )}
                <div className="mt-2 flex items-center gap-2 text-[13px] text-muted">
                  <CropThumb imageUrl={offer.batch.crop.imageUrl} name={offer.batch.crop.name} size="sm" />
                  <span>
                    {crop(offer.batch.crop)} ·{' '}
                    {t('offers.wants', {
                      place: offer.arhti.location ? place(offer.arhti.location) : t('offers.arhti'),
                      qty: kg(offer.quantityKg),
                      batch: offer.batch.batchNumber,
                    })}
                  </span>
                </div>

                <div className="mt-4 grid grid-cols-[1fr_1.6fr] gap-2">
                  <ActionForm
                    action={respondToOffer}
                    hidden={{ offerId: offer.id, decision: 'REJECT' }}
                    submitLabel={t('offers.decline')}
                    variant="outline"
                    icon="x"
                    className="[&>button]:mt-0"
                  />
                  <ActionForm
                    action={respondToOffer}
                    hidden={{ offerId: offer.id, decision: 'ACCEPT' }}
                    submitLabel={t('offers.acceptAmount', { amount: money(total) })}
                    variant={isBest ? 'primary' : 'outline'}
                    icon="check"
                    className="[&>button]:mt-0"
                  />
                </div>
              </article>
            );
          })}
        </div>
      )}

      <details className="card mt-6 overflow-hidden [&[open]>summary_.chev]:rotate-180">
        <summary className="flex min-h-[64px] cursor-pointer list-none items-center gap-3 px-4">
          <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sage text-forest">
            <Icon name="list" size={20} />
          </span>
          <span className="flex-1 text-[15px] font-bold">{t('offers.demandTitle')}</span>
          <Icon name="chevrondown" size={20} className="chev text-muted transition-transform" />
        </summary>
        <div className="border-t border-line p-4">
          {openDemand.length === 0 ? (
            <p className="text-sm text-muted">{t('offers.noDemand')}</p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {openDemand.map((req) => (
                <div key={req.id} className="rounded-2xl bg-paper p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[15px] font-bold">{crop(req.crop)}</span>
                    <Badge tone="green" icon="pin">{place(req.mandi.city)}</Badge>
                  </div>
                  <div className="mt-0.5 text-[13px] text-muted">{req.arhti.name}</div>
                  <div className="mt-2 text-sm">
                    {t('offers.demandWants', { min: kg(req.minQuantityKg), max: kg(req.maxQuantityKg) })}
                    {req.gradeWanted ? ` • ${grade(req.gradeWanted)}` : ''}
                  </div>
                  <div className="mt-1 text-sm font-bold text-goldtext">
                    {req.targetPriceMin && req.targetPriceMax
                      ? t('offers.rateRange', { min: perKg(req.targetPriceMin), max: perKg(req.targetPriceMax) })
                      : t('offers.rateOnDiscussion')}
                  </div>
                  <div className="mt-1 text-[13px] text-muted">
                    {t('offers.neededBy', { date: date(req.neededBy) })}
                    {req.transportOffered ? ` • ${t('offers.arhtiTransport')}` : ''}
                  </div>
                </div>
              ))}
            </div>
          )}

          {answeredOffers.length > 0 && (
            <>
              <h3 className="mb-2 mt-6 text-xs font-bold uppercase tracking-[.08em] text-muted">{t('offers.history')}</h3>
              <div className="divide-y divide-line overflow-hidden rounded-2xl border border-line">
                {answeredOffers.map((offer) => (
                  <div key={offer.id} className="flex items-center justify-between gap-3 px-4 py-3">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-bold">
                        {crop(offer.batch.crop)} • {offer.arhti.name}
                      </div>
                      <div className="text-[13px] text-muted">
                        {t('offers.qtyAt', { qty: kg(offer.quantityKg), rate: perKg(offer.pricePerKg) })}
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <Badge tone={statusTone(offer.status)}>{status(offer.status)}</Badge>
                      {offer.deal && (
                        <Link href={`/deals/${offer.deal.id}`} className="inline-flex min-h-11 items-center text-sm font-bold text-forest">
                          {t('offers.viewDeal')}
                        </Link>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </details>
    </div>
  );
}
