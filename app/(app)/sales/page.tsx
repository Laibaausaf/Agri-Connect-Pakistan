import Link from 'next/link';
import { SaleStatus, UserRole } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { requireCapability } from '@/lib/authz';
import { getI18n } from '@/lib/i18n/server';
import { getArhtiEarnings } from '@/lib/earnings';
import ArhtiEarnings from '@/components/dashboards/ArhtiEarnings';
import {
  Badge,
  Card,
  CropThumb,
  EmptyState,
  PageHeader,
  StatCard,
  statusTone,
} from '@/components/ui/kit';

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
    <div className="max-w-4xl mx-auto">
      <PageHeader
        title={t('sales.arhtiTitle')}
        subtitle={t('sales.arhtiSubtitle')}
      />

      <div className="grid grid-cols-3 gap-3 mb-4">
        <StatCard label={t('sales.statSales')} value={String(sales.length)} />
        <StatCard label={t('sales.statVolume')} value={kg(volume)} />
        <StatCard label={t('sales.statRevenue')} value={money(Math.round(revenue))} tone="accent" />
      </div>

      <ArhtiEarnings earnings={earnings} i18n={i18n} />

      {sales.length === 0 ? (
        <EmptyState
          title={t('sales.arhtiEmptyTitle')}
          message={t('sales.arhtiEmptyMessage')}
          actionHref="/auction-house"
          actionLabel={t('sales.arhtiEmptyAction')}
        />
      ) : (
        <div className="space-y-3">
          {sales.map((sale) => {
            const lot = sale.auction.inventoryLot;
            const margin = sale.ratePerKg - lot.purchasePricePerKg;
            return (
              <Card key={sale.id}>
                <div className="flex items-start gap-3">
                  <CropThumb imageUrl={lot.crop.imageUrl} name={lot.crop.name} size="md" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-bold text-charcoal">{crop(lot.crop)}</span>
                      <Badge tone={statusTone(sale.status)}>{status(sale.status)}</Badge>
                      <Badge tone="neutral">{grade(sale.auction.grade)}</Badge>
                    </div>
                    <div className="text-[11px] text-[#636E72] mt-0.5">
                      {t('sales.boughtSold', {
                        farmer: lot.sourceFarmerName,
                        city: place(lot.sourceCity),
                        vendor: sale.vendor.vendorProfile?.businessName ?? sale.vendor.name,
                      })}
                    </div>
                    <div className="text-[10px] text-[#636E72] font-mono">
                      {sale.saleNumber} · {sale.auction.auctionNumber} · {lot.lotNumber}
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-2 text-xs">
                      <div>
                        <div className="text-[10px] text-[#636E72]">{t('sales.quantity')}</div>
                        <div className="font-semibold text-charcoal">{kg(sale.quantityKg)}</div>
                      </div>
                      <div>
                        <div className="text-[10px] text-[#636E72]">{t('sales.boughtAt')}</div>
                        <div className="font-semibold text-charcoal">
                          {perKg(lot.purchasePricePerKg)}
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] text-[#636E72]">{t('sales.soldAt')}</div>
                        <div className="font-semibold text-agri-900">
                          {perKg(sale.ratePerKg)}
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] text-[#636E72]">{t('sales.margin')}</div>
                        <div
                          className={`font-semibold ${margin >= 0 ? 'text-agri-900' : 'text-red-700'}`}
                        >
                          {margin >= 0 ? '+' : ''}
                          {perKg(margin)}
                        </div>
                        <div className="text-[10px] text-[#636E72]">
                          {t('sales.total', { amount: money(Math.round(margin * sale.quantityKg)) })}
                        </div>
                      </div>
                    </div>
                    <div className="text-[11px] text-[#636E72] mt-2">
                      {t('sales.vendorCommission', {
                        commission: money(sale.commission),
                        paid: money(sale.grossAmount + sale.commission),
                      })}
                    </div>
                  </div>
                </div>
              </Card>
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
    <div className="max-w-4xl mx-auto">
      <PageHeader
        title={t('sales.vendorTitle')}
        subtitle={t('sales.vendorSubtitle')}
        action={
          <Link
            href="/wholesale-shop"
            className="text-[11px] font-semibold text-agri-900 hover:underline whitespace-nowrap"
          >
            {t('sales.myShop')}
          </Link>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <StatCard label={t('sales.statOrders')} value={String(sales.length)} />
        <StatCard label={t('sales.statOpen')} value={String(openOrders)} tone={openOrders ? 'accent' : 'default'} />
        <StatCard label={t('sales.statVolume')} value={kg(volume)} />
        <StatCard label={t('sales.statRevenue')} value={money(Math.round(revenue))} />
      </div>

      {sales.length === 0 ? (
        <EmptyState
          title={t('sales.vendorEmptyTitle')}
          message={t('sales.vendorEmptyMessage')}
          actionHref="/wholesale-shop/new"
          actionLabel={t('sales.vendorEmptyAction')}
        />
      ) : (
        <div className="space-y-3">
          {sales.map((sale) => {
            const margin = sale.ratePerKg - sale.offer.stock.costPerKg;
            const shop = sale.shopkeeper.shopkeeperProfile;
            return (
              <Card key={sale.id}>
                <div className="flex items-start gap-3">
                  <CropThumb
                    imageUrl={sale.offer.crop.imageUrl}
                    name={sale.offer.crop.name}
                    size="md"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-bold text-charcoal">
                        {crop(sale.offer.crop)}
                      </span>
                      <Badge tone={statusTone(sale.status)}>{status(sale.status)}</Badge>
                      <Badge tone="neutral">{grade(sale.offer.grade)}</Badge>
                    </div>
                    <div className="text-[11px] text-[#636E72] mt-0.5">
                      {shop?.shopName ?? sale.shopkeeper.name}
                      {shop?.city ? `, ${place(shop.city)}` : ''} ·{' '}
                      {place(sale.deliveryCity ?? sale.shopkeeper.location) || '—'}
                    </div>
                    <div className="text-[10px] text-[#636E72] font-mono">
                      {sale.saleNumber} · {sale.offer.offerNumber}
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-2 text-xs">
                      <div>
                        <div className="text-[10px] text-[#636E72]">{t('sales.quantity')}</div>
                        <div className="font-semibold text-charcoal">{kg(sale.quantityKg)}</div>
                      </div>
                      <div>
                        <div className="text-[10px] text-[#636E72]">{t('sales.mandiCost')}</div>
                        <div className="font-semibold text-charcoal">
                          {perKg(sale.offer.stock.costPerKg)}
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] text-[#636E72]">{t('sales.soldAt')}</div>
                        <div className="font-semibold text-agri-900">
                          {perKg(sale.ratePerKg)}
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] text-[#636E72]">{t('sales.orderValue')}</div>
                        <div className="font-semibold text-charcoal">
                          {money(sale.grossAmount)}
                        </div>
                        <div className="text-[10px] text-[#636E72]">
                          {t('sales.marginPerKg', { rate: `${margin >= 0 ? '+' : ''}${perKg(margin)}` })}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
