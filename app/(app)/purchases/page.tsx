import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { requireCapability } from '@/lib/authz';
import { getI18n } from '@/lib/i18n/server';
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

export default async function PurchasesPage() {
  const user = await requireCapability('shopkeeper.wholesale.purchase');
  const { t, crop, place, status, kg, perKg, money, date } = await getI18n();

  const purchases = await prisma.vendorShopkeeperSale.findMany({
    where: { shopkeeperId: user.id },
    include: {
      vendor: {
        select: { name: true, vendorProfile: { select: { businessName: true, warehouseCity: true } } },
      },
      offer: {
        select: {
          offerNumber: true,
          deliveryEtaHours: true,
          crop: { select: { name: true, nameUrdu: true, imageUrl: true } },
          stock: { select: { sourceFarmCity: true, sourceMandiCity: true } },
        },
      },
      shopkeeperInventory: {
        select: { id: true, stockNumber: true, availableKg: true, quantityKg: true },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  const spend = purchases.reduce((sum, p) => sum + p.grossAmount, 0);
  const boughtKg = purchases.reduce((sum, p) => sum + p.quantityKg, 0);
  const avgRate = boughtKg > 0 ? spend / boughtKg : 0;

  return (
    <div className="max-w-3xl mx-auto">
      <PageHeader
        title={t('purchases.title')}
        subtitle={t('purchases.subtitle')}
        action={
          <Link
            href="/wholesale"
            className="btn btn-outline btn-sm whitespace-nowrap"
          >
            {t('purchases.market')}
          </Link>
        }
      />

      <div className="grid grid-cols-3 gap-3 mb-4">
        <StatCard label={t('purchases.statOrders')} value={String(purchases.length)} />
        <StatCard label={t('purchases.statQty')} value={kg(boughtKg)} tone="accent" />
        <StatCard
          label={t('purchases.statSpend')}
          value={money(spend)}
          hint={avgRate ? t('purchases.avg', { rate: perKg(avgRate) }) : undefined}
        />
      </div>

      {purchases.length === 0 ? (
        <EmptyState
          title={t('purchases.emptyTitle')}
          message={t('purchases.emptyMessage')}
          actionHref="/wholesale"
          actionLabel={t('purchases.emptyAction')}
        />
      ) : (
        <div className="space-y-3">
          {purchases.map((purchase) => {
            const stock = purchase.shopkeeperInventory;
            const soldOn = stock ? stock.quantityKg - stock.availableKg : 0;
            return (
              <Card key={purchase.id}>
                <div className="flex items-start gap-3">
                  <CropThumb
                    imageUrl={purchase.offer.crop.imageUrl}
                    name={purchase.offer.crop.name}
                    size="sm"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[17px] font-bold text-ink">
                        {crop(purchase.offer.crop)}
                      </span>
                      <Badge tone={statusTone(purchase.status)}>
                        {status(purchase.status)}
                      </Badge>
                    </div>
                    <div className="text-[13px] text-muted font-mono mt-0.5">
                      {purchase.saleNumber}
                    </div>
                    <div className="text-[13px] text-muted">
                      {t('purchases.from', {
                        vendor: purchase.vendor.vendorProfile?.businessName ?? purchase.vendor.name,
                        farm: place(purchase.offer.stock.sourceFarmCity),
                        mandi: place(purchase.offer.stock.sourceMandiCity),
                      })}
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-2 text-sm">
                      <div>
                        <div className="text-[12.5px] text-muted">{t('purchases.quantity')}</div>
                        <div className="font-semibold text-ink">{kg(purchase.quantityKg)}</div>
                      </div>
                      <div>
                        <div className="text-[12.5px] text-muted">{t('purchases.ratePaid')}</div>
                        <div className="font-semibold text-ink">
                          {perKg(purchase.ratePerKg)}
                        </div>
                      </div>
                      <div>
                        <div className="text-[12.5px] text-muted">{t('purchases.orderValue')}</div>
                        <div className="font-semibold text-forest">
                          {money(purchase.grossAmount)}
                        </div>
                      </div>
                      <div>
                        <div className="text-[12.5px] text-muted">{t('purchases.ordered')}</div>
                        <div className="font-semibold text-ink">
                          {date(purchase.createdAt, { day: 'numeric', month: 'short' })}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {stock && (
                  <div className="mt-3 pt-3 border-t border-line flex items-center justify-between gap-2 text-[13px]">
                    <span className="text-muted">
                      {t('purchases.inShopAs')} <span className="font-mono">{stock.stockNumber}</span> ·{' '}
                      {t('purchases.unlisted', { qty: kg(stock.availableKg) })}
                      {soldOn > 0 ? t('purchases.moved', { qty: kg(soldOn) }) : ''}
                    </span>
                    <Link
                      href="/shop-stock"
                      className="font-semibold text-forest hover:underline whitespace-nowrap"
                    >
                      {t('purchases.openStock')}
                    </Link>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
