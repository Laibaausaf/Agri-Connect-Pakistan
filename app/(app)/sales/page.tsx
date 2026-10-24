import Link from 'next/link';
import { SaleStatus, UserRole } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { requireCapability } from '@/lib/authz';
import { getI18n } from '@/lib/i18n/server';
import { getArhtiEarnings } from '@/lib/earnings';
import ArhtiEarnings from '@/components/dashboards/ArhtiEarnings';
import { Badge, CropThumb, EmptyState, PageHeader, statusTone } from '@/components/ui/kit';
import Icon from '@/components/ui/Icon';

/** Small summary figure on a sage tile. */
function Tile({ value, label, gold = false }: { value: string; label: string; gold?: boolean }) {
  return (
    <div className="rounded-2xl bg-sage px-4 py-3">
      <div className={`tabular text-xl font-extrabold leading-tight ${gold ? 'text-goldtext' : ''}`}>{value}</div>
      <div className="text-[12.5px] font-semibold text-muted">{label}</div>
    </div>
  );
}

/** One figure in a card's figure row. */
function Figure({ label, value, hint, tone }: { label: string; value: string; hint?: string; tone?: 'ok' | 'err' | 'gold' }) {
  const color = tone === 'ok' ? 'text-ok-fg' : tone === 'err' ? 'text-err-fg' : tone === 'gold' ? 'text-goldtext' : '';
  return (
    <div className="p-3 sm:p-4">
      <dt className="text-[12.5px] text-muted">{label}</dt>
      <dd className={`tabular text-base font-extrabold ${color}`}>{value}</dd>
      {hint && <dd className="text-[12.5px] text-muted">{hint}</dd>}
    </div>
  );
}

export const dynamic = 'force-dynamic';

export default async function SalesPage() {
  const user = await requireCapability('arhti.sales.view', 'vendor.sales.view');

  if (user.role === UserRole.VENDOR) return <VendorSales userId={user.id} />;
  return <ArhtiSales userId={user.id} />;
}

async function ArhtiSales({ userId }: { userId: string }) {
  const i18n = await getI18n();
  const { t, crop, place, status, grade, kg, perKg, money } = i18n;
  const earnings = await getArhtiEarnings(userId);
  const sales = await prisma.arhtiVendorSale.findMany({
    where: { arhtiId: userId },
    include: {
      vendor: { select: { name: true, vendorProfile: { select: { businessName: true, warehouseCity: true } } } },
      auction: {
        select: {
          auctionNumber: true,
          grade: true,
          inventoryLot: {
            select: {
              lotNumber: true,
              sourceCity: true,
              sourceFarmerName: true,
              purchasePricePerKg: true,
              crop: { select: { name: true, nameUrdu: true, imageUrl: true } },
            },
          },
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  const revenue = sales.reduce((sum, s) => sum + s.grossAmount, 0);
  const volume = sales.reduce((sum, s) => sum + s.quantityKg, 0);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader title={t('sales.arhtiTitle')} subtitle={t('sales.arhtiSubtitle')} />
      <ArhtiEarnings earnings={earnings} i18n={i18n} />
      <div className="grid grid-cols-3 gap-2">
        <Tile value={String(sales.length)} label={t('sales.statSales')} />
        <Tile value={kg(volume)} label={t('sales.statVolume')} />
        <Tile value={money(Math.round(revenue))} label={t('sales.statRevenue')} gold />
      </div>

      {sales.length === 0 ? (
        <EmptyState title={t('sales.arhtiEmptyTitle')} message={t('sales.arhtiEmptyMessage')} actionHref="/auction-house" actionLabel={t('sales.arhtiEmptyAction')} />
      ) : (
        <div className="space-y-4">
          {sales.map((sale) => {
            const lot = sale.auction.inventoryLot;
            const margin = sale.ratePerKg - lot.purchasePricePerKg;
            return (
              <article key={sale.id} className="card overflow-hidden">
                <div className="flex items-start gap-3 p-4">
                  <CropThumb imageUrl={lot.crop.imageUrl} name={lot.crop.name} size="md" />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[17px] font-extrabold">
                        {crop(lot.crop)} · {grade(sale.auction.grade)}
                      </span>
                      <Badge tone={statusTone(sale.status)}>{status(sale.status)}</Badge>
                    </div>
                    <div className="text-[13px] text-muted">
                      {t('sales.boughtSold', { farmer: lot.sourceFarmerName, city: place(lot.sourceCity), vendor: sale.vendor.vendorProfile?.businessName ?? sale.vendor.name })}
                    </div>
                    <div className="font-mono text-[12.5px] text-muted">
                      {sale.saleNumber} · {sale.auction.auctionNumber} · {lot.lotNumber}
                    </div>
                  </div>
                </div>
                <dl className="grid grid-cols-2 divide-line border-t border-line sm:grid-cols-4 sm:divide-x rtl:divide-x-reverse">
                  <Figure label={t('sales.quantity')} value={kg(sale.quantityKg)} />
                  <Figure label={t('sales.boughtAt')} value={perKg(lot.purchasePricePerKg)} />
                  <Figure label={t('sales.soldAt')} value={perKg(sale.ratePerKg)} tone="gold" />
                  <Figure
                    label={t('sales.margin')}
                    value={`${margin >= 0 ? '+' : ''}${perKg(margin)}`}
                    hint={t('sales.total', { amount: money(Math.round(margin * sale.quantityKg)) })}
                    tone={margin >= 0 ? 'ok' : 'err'}
                  />
                </dl>
                <p className="flex items-start gap-2 border-t border-line bg-paper px-4 py-3 text-[13px] text-muted">
                  <Icon name="info" size={16} className="mt-0.5" />
                  {t('sales.vendorCommission', { commission: money(sale.commission), paid: money(sale.grossAmount + sale.commission) })}
                </p>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}

async function VendorSales({ userId }: { userId: string }) {
  const { t, crop, place, status, grade, kg, perKg, money } = await getI18n();
  const sales = await prisma.vendorShopkeeperSale.findMany({
    where: { vendorId: userId },
    include: {
      shopkeeper: {
        select: {
          name: true,
          location: true,
          shopkeeperProfile: { select: { shopName: true, city: true } },
        },
      },
      offer: {
        select: {
          offerNumber: true,
          grade: true,
          crop: { select: { name: true, nameUrdu: true, imageUrl: true } },
          stock: { select: { costPerKg: true, sourceFarmCity: true, sourceMandiCity: true } },
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  const revenue = sales.reduce((sum, s) => sum + s.grossAmount, 0);
  const volume = sales.reduce((sum, s) => sum + s.quantityKg, 0);
  const openOrders = sales.filter(
    (s) => s.status !== SaleStatus.COMPLETED && s.status !== SaleStatus.CANCELLED
  ).length;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader
        title={t('sales.vendorTitle')}
        subtitle={t('sales.vendorSubtitle')}
        action={
          <Link href="/wholesale-shop" className="btn btn-outline btn-sm">
            <Icon name="store" size={16} />
            {t('sales.myShop')}
          </Link>
        }
      />
      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        <Tile value={String(sales.length)} label={t('sales.statOrders')} />
        <Tile value={String(openOrders)} label={t('sales.statOpen')} gold={openOrders > 0} />
        <Tile value={kg(volume)} label={t('sales.statVolume')} />
        <Tile value={money(Math.round(revenue))} label={t('sales.statRevenue')} />
      </div>

      {sales.length === 0 ? (
        <EmptyState title={t('sales.vendorEmptyTitle')} message={t('sales.vendorEmptyMessage')} actionHref="/wholesale-shop/new" actionLabel={t('sales.vendorEmptyAction')} />
      ) : (
        <div className="space-y-4">
          {sales.map((sale) => {
            const margin = sale.ratePerKg - sale.offer.stock.costPerKg;
            const shop = sale.shopkeeper.shopkeeperProfile;
            return (
              <article key={sale.id} className="card overflow-hidden">
                <div className="flex items-start gap-3 p-4">
                  <CropThumb imageUrl={sale.offer.crop.imageUrl} name={sale.offer.crop.name} size="md" />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[17px] font-extrabold">
                        {crop(sale.offer.crop)} · {grade(sale.offer.grade)}
                      </span>
                      <Badge tone={statusTone(sale.status)}>{status(sale.status)}</Badge>
                    </div>
                    <div className="text-[13px] text-muted">
                      {shop?.shopName ?? sale.shopkeeper.name}
                      {shop?.city ? `, ${place(shop.city)}` : ''} · {place(sale.deliveryCity ?? sale.shopkeeper.location) || '—'}
                    </div>
                    <div className="font-mono text-[12.5px] text-muted">
                      {sale.saleNumber} · {sale.offer.offerNumber}
                    </div>
                  </div>
                </div>
                <dl className="grid grid-cols-2 border-t border-line sm:grid-cols-4">
                  <Figure label={t('sales.quantity')} value={kg(sale.quantityKg)} />
                  <Figure label={t('sales.mandiCost')} value={perKg(sale.offer.stock.costPerKg)} />
                  <Figure label={t('sales.soldAt')} value={perKg(sale.ratePerKg)} tone="gold" />
                  <Figure label={t('sales.orderValue')} value={money(sale.grossAmount)} hint={t('sales.marginPerKg', { rate: `${margin >= 0 ? '+' : ''}${perKg(margin)}` })} />
                </dl>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
