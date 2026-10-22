import Link from 'next/link';
import { OfferListingStatus } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { requireCapability } from '@/lib/authz';
import { setVendorOfferStatus } from '@/lib/actions/wholesale';
import ActionForm from '@/components/ui/ActionForm';
import { getI18n } from '@/lib/i18n/server';
import {
  Badge,
  Card,
  CropThumb,
  EmptyState,
  PageHeader,
  StatCard,
} from '@/components/ui/kit';

export const dynamic = 'force-dynamic';

function firstPhoto(photos: unknown): string | null {
  if (Array.isArray(photos) && typeof photos[0] === 'string') return photos[0];
  return null;
}

function cities(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((v): v is string => typeof v === 'string');
  return [];
}

export default async function WholesaleShopPage() {
  const user = await requireCapability('vendor.offers.manage');
  const { t, crop, place, status, grade, kg, perKg, money } = await getI18n();

  const offers = await prisma.vendorOffer.findMany({
    where: { vendorId: user.id },
    include: {
      crop: true,
      stock: {
        select: { stockNumber: true, costPerKg: true, sourceFarmCity: true, sourceMandiCity: true },
      },
      sales: {
        select: {
          id: true,
          saleNumber: true,
          quantityKg: true,
          ratePerKg: true,
          grossAmount: true,
          createdAt: true,
          shopkeeper: {
            select: { name: true, shopkeeperProfile: { select: { shopName: true, city: true } } },
          },
        },
        orderBy: { createdAt: 'desc' },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  const open = offers.filter(
    (o) => o.status === OfferListingStatus.ACTIVE || o.status === OfferListingStatus.PAUSED
  );
  const closed = offers.filter(
    (o) => o.status === OfferListingStatus.SOLD_OUT || o.status === OfferListingStatus.CLOSED
  );

  const onShelf = open.reduce((sum, o) => sum + o.remainingKg, 0);
  const soldKg = offers.reduce(
    (sum, o) => sum + o.sales.reduce((acc, s) => acc + s.quantityKg, 0),
    0
  );
  const revenue = offers.reduce(
    (sum, o) => sum + o.sales.reduce((acc, s) => acc + s.grossAmount, 0),
    0
  );
  const margin = offers.reduce(
    (sum, o) =>
      sum + o.sales.reduce((acc, s) => acc + s.quantityKg * (s.ratePerKg - o.stock.costPerKg), 0),
    0
  );

  return (
    <div className="max-w-4xl mx-auto">
      <PageHeader
        title={t('wshop.title')}
        subtitle={t('wshop.subtitle')}
        action={
          <Link
            href="/wholesale-shop/new"
            className="bg-agri-900 hover:bg-agri-800 text-white text-[11px] font-semibold px-3 py-2 rounded-xl whitespace-nowrap"
          >
            {t('wshop.list')}
          </Link>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <StatCard label={t('wshop.statShelf')} value={String(open.length)} />
        <StatCard label={t('wshop.statAvailable')} value={kg(onShelf)} tone="accent" />
        <StatCard label={t('wshop.statSold')} value={kg(soldKg)} />
        <StatCard
          label={t('wshop.statRevenue')}
          value={money(revenue)}
          hint={soldKg > 0 ? t('wshop.marginOver', { amount: money(margin) }) : undefined}
        />
      </div>

      {offers.length === 0 ? (
        <EmptyState
          title={t('wshop.emptyTitle')}
          message={t('wshop.emptyMessage')}
          actionHref="/stock"
          actionLabel={t('wshop.emptyAction')}
        />
      ) : (
        <div className="space-y-3">
          {open.map((offer) => {
            const sold = offer.offeredQuantityKg - offer.remainingKg;
            const marginPerKg = offer.pricePerKg - offer.stock.costPerKg;
            const isActive = offer.status === OfferListingStatus.ACTIVE;
            return (
              <Card key={offer.id}>
                <div className="flex items-start gap-3">
                  <CropThumb
                    imageUrl={firstPhoto(offer.photos) ?? offer.crop.imageUrl}
                    name={offer.crop.name}
                    size="md"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-bold text-charcoal">{crop(offer.crop)}</span>
                      <Badge tone="neutral">{grade(offer.grade)}</Badge>
                      <Badge tone={isActive ? 'green' : 'amber'}>{status(offer.status)}</Badge>
                    </div>
                    <div className="text-[11px] text-[#636E72] font-mono mt-0.5">
                      {offer.offerNumber} · {offer.stock.stockNumber}
                    </div>
                    <div className="text-[11px] text-[#636E72]">
                      {t('wshop.route', {
                        farm: place(offer.stock.sourceFarmCity),
                        mandi: place(offer.stock.sourceMandiCity),
                        hours: offer.deliveryEtaHours,
                        cities: place(cities(offer.deliveryCities).join(', ')) || t('wshop.anyCity'),
                      })}
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-2 text-xs">
                      <div>
                        <div className="text-[10px] text-[#636E72]">{t('wshop.yourPrice')}</div>
                        <div className="font-semibold text-agri-900">
                          {perKg(offer.pricePerKg)}
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] text-[#636E72]">{t('wshop.mandiCost')}</div>
                        <div className="font-semibold text-charcoal">
                          {perKg(offer.stock.costPerKg)}
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] text-[#636E72]">{t('wshop.margin')}</div>
                        <div className="font-semibold text-charcoal">
                          +{perKg(marginPerKg)}
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] text-[#636E72]">{t('wshop.remaining')}</div>
                        <div className="font-semibold text-charcoal">
                          {kg(offer.remainingKg)}
                          <span className="text-[10px] font-normal text-[#636E72]">
                            {' '}
                            {t('wshop.of', { qty: kg(offer.offeredQuantityKg) })}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="mt-2 h-1.5 rounded-full bg-[#F2F4F7] overflow-hidden">
                      <div
                        className="h-full bg-agri-900"
                        style={{
                          width: `${Math.min(100, Math.round((sold / offer.offeredQuantityKg) * 100))}%`,
                        }}
                      />
                    </div>
                    <div className="text-[10px] text-[#636E72] mt-1">
                      {t('wshop.soldMin', { sold: kg(sold), min: kg(offer.minOrderKg) })}
                    </div>
                  </div>
                </div>

                {offer.sales.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-[#E5E7EB] space-y-1.5">
                    {offer.sales.map((sale) => (
                      <div
                        key={sale.id}
                        className="flex items-center justify-between gap-2 text-[11px]"
                      >
                        <span className="text-[#636E72] truncate">
                          {sale.shopkeeper.shopkeeperProfile?.shopName ?? sale.shopkeeper.name}
                          {sale.shopkeeper.shopkeeperProfile?.city
                            ? `, ${place(sale.shopkeeper.shopkeeperProfile.city)}`
                            : ''}{' '}
                          · {kg(sale.quantityKg)}
                        </span>
                        <span className="font-semibold text-charcoal whitespace-nowrap">
                          {money(sale.grossAmount)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                <div className="mt-3 pt-3 border-t border-[#E5E7EB]">
                  <ActionForm
                    action={setVendorOfferStatus}
                    submitLabel={isActive ? t('wshop.takeOff') : t('wshop.putBack')}
                    variant={isActive ? 'secondary' : 'inline'}
                    hidden={{ offerId: offer.id, status: isActive ? 'PAUSED' : 'ACTIVE' }}
                  />
                </div>
              </Card>
            );
          })}

          {closed.length > 0 && (
            <div className="pt-2">
              <h2 className="text-[11px] font-bold uppercase tracking-wider text-[#636E72] mb-2">
                {t('wshop.cleared')}
              </h2>
              <Card padded={false}>
                <div className="divide-y divide-[#E5E7EB]">
                  {closed.map((offer) => (
                    <div
                      key={offer.id}
                      className="p-3 flex items-center justify-between gap-3 text-[11px]"
                    >
                      <div className="min-w-0">
                        <div className="font-semibold text-charcoal">
                          {crop(offer.crop)} · {kg(offer.offeredQuantityKg)}
                        </div>
                        <div className="text-[#636E72] font-mono">{offer.offerNumber}</div>
                      </div>
                      <div className="text-end whitespace-nowrap">
                        <div className="font-semibold text-charcoal">
                          {perKg(offer.pricePerKg)}
                        </div>
                        <Badge tone="neutral">{status(offer.status)}</Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
