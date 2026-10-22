import Link from 'next/link';
import { ConsumerOrderStatus, TransactionType } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { requireCapability } from '@/lib/authz';
import { rateShop } from '@/lib/actions/retail';
import ActionForm, { Field, inputClass } from '@/components/ui/ActionForm';
import { getI18n } from '@/lib/i18n/server';
import { Badge, Card, CropThumb, EmptyState } from '@/components/ui/kit';
import { Clock, MapPin, Sprout, Star } from 'lucide-react';

export const dynamic = 'force-dynamic';

const STEPS: ConsumerOrderStatus[] = [
  ConsumerOrderStatus.PLACED,
  ConsumerOrderStatus.CONFIRMED,
  ConsumerOrderStatus.PREPARING,
  ConsumerOrderStatus.OUT_FOR_DELIVERY,
  ConsumerOrderStatus.DELIVERED,
];

const STEP_LABEL = {
  PLACED: 'corders.stepPlaced',
  CONFIRMED: 'corders.stepConfirmed',
  PREPARING: 'corders.stepPreparing',
  OUT_FOR_DELIVERY: 'corders.stepOnWay',
  DELIVERED: 'corders.stepDelivered',
  CANCELLED: 'corders.stepCancelled',
} as const satisfies Record<ConsumerOrderStatus, string>;

export default async function ConsumerOrdersPage() {
  const user = await requireCapability('consumer.orders.view');
  const { t, place, kg, perKg, money, dateTime, time } = await getI18n();

  const orders = await prisma.consumerOrder.findMany({
    where: { consumerId: user.id },
    include: {
      shopkeeper: {
        select: {
          name: true,
          phone: true,
          shopkeeperProfile: { select: { shopName: true, shopAddress: true, city: true } },
        },
      },
      items: {
        select: {
          id: true,
          quantityKg: true,
          pricePerKg: true,
          lineTotal: true,
          listing: {
            select: {
              title: true,
              imageUrl: true,
              crop: { select: { name: true, imageUrl: true } },
              stock: {
                select: {
                  sale: {
                    select: { offer: { select: { stock: { select: { sourceFarmCity: true } } } } },
                  },
                },
              },
            },
          },
        },
      },
    },
    orderBy: { placedAt: 'desc' },
  });

  const rated = await prisma.rating.findMany({
    where: {
      raterId: user.id,
      transactionType: TransactionType.SHOPKEEPER_CONSUMER,
      transactionId: { in: orders.map((o) => o.id) },
    },
    select: { transactionId: true, overallRating: true },
  });
  const ratingByOrder = new Map(rated.map((r) => [r.transactionId, r.overallRating]));

  return (
    <div>
      <div className="mb-4">
        <h1 className="text-lg font-bold text-charcoal">
          {t('corders.title')}
        </h1>
        <p className="text-xs text-[#636E72] mt-0.5">
          {t('corders.subtitle')}
        </p>
      </div>

      {orders.length === 0 ? (
        <EmptyState
          title={t('corders.emptyTitle')}
          message={t('corders.emptyMessage')}
          actionHref="/shop"
          actionLabel={t('corders.emptyAction')}
        />
      ) : (
        <div className="space-y-3">
          {orders.map((order) => {
            const shop = order.shopkeeper.shopkeeperProfile;
            const cancelled = order.status === ConsumerOrderStatus.CANCELLED;
            const stepIdx = cancelled ? -1 : STEPS.indexOf(order.status);
            const myRating = ratingByOrder.get(order.id);
            const canRate = order.status === ConsumerOrderStatus.DELIVERED && myRating === undefined;
            return (
              <Card key={order.id}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-bold text-charcoal">
                        {shop?.shopName ?? order.shopkeeper.name}
                      </span>
                      <Badge
                        tone={
                          cancelled
                            ? 'red'
                            : order.status === ConsumerOrderStatus.DELIVERED
                              ? 'green'
                              : 'amber'
                        }
                      >
                        {t(STEP_LABEL[order.status])}
                      </Badge>
                    </div>
                    <div className="text-[11px] text-[#636E72] font-mono mt-0.5">
                      {order.orderNumber}
                    </div>
                    <div className="text-[11px] text-[#636E72] flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {order.deliveredAt
                        ? t('corders.delivered', { when: dateTime(order.deliveredAt, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) })
                        : t('corders.eta', { count: order.etaMinutes, time: time(order.placedAt, { hour: '2-digit', minute: '2-digit' }) })}
                    </div>
                  </div>
                  <div className="text-end whitespace-nowrap">
                    <div className="text-sm font-bold text-agri-900">{money(order.totalAmount)}</div>
                    <div className="text-[10px] text-[#636E72]">
                      {order.deliveryFee > 0
                        ? t('rorders.inclDelivery', { amount: money(order.deliveryFee) })
                        : t('rorders.freeDelivery')}
                    </div>
                  </div>
                </div>

                {!cancelled && (
                  <div className="mt-3 flex items-center gap-1">
                    {STEPS.map((step, idx) => (
                      <div key={step} className="flex-1">
                        <div
                          className={`h-1.5 rounded-full ${
                            idx <= stepIdx ? 'bg-agri-900' : 'bg-[#F2F4F7]'
                          }`}
                        />
                        <div
                          className={`text-[9px] mt-1 ${
                            idx <= stepIdx ? 'text-agri-900 font-semibold' : 'text-[#636E72]'
                          }`}
                        >
                          {t(STEP_LABEL[step])}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <div className="mt-3 pt-3 border-t border-[#E5E7EB] space-y-2">
                  {order.items.map((item) => {
                    const farmCity = item.listing.stock.sale.offer.stock.sourceFarmCity;
                    return (
                      <div key={item.id} className="flex items-center gap-2.5">
                        <CropThumb
                          imageUrl={item.listing.imageUrl ?? item.listing.crop.imageUrl}
                          name={item.listing.crop.name}
                          size="sm"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-semibold text-charcoal truncate">
                            {item.listing.title}
                          </div>
                          <div className="text-[10px] text-[#636E72]">
                            {t('corders.itemLine', { qty: kg(item.quantityKg), rate: perKg(item.pricePerKg) })}
                          </div>
                          <div className="text-[10px] text-agri-900 flex items-center gap-1">
                            <Sprout className="w-3 h-3" />
                            {t('corders.grownIn', { city: place(farmCity) })}
                          </div>
                        </div>
                        <div className="text-xs font-semibold text-charcoal whitespace-nowrap">
                          {money(item.lineTotal)}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {order.deliveryAddress && (
                  <div className="mt-3 text-[11px] text-[#636E72] flex items-start gap-1">
                    <MapPin className="w-3 h-3 mt-0.5 shrink-0" />
                    {order.deliveryAddress}
                  </div>
                )}

                {myRating !== undefined && (
                  <div className="mt-3 pt-3 border-t border-[#E5E7EB] text-[11px] text-[#636E72] flex items-center gap-1">
                    <Star className="w-3 h-3" />
                    {t('corders.youRated', { rating: myRating })}
                  </div>
                )}

                {canRate && (
                  <details className="mt-3 pt-3 border-t border-[#E5E7EB]">
                    <summary className="text-[11px] font-semibold text-agri-900 cursor-pointer">
                      {t('corders.rate')}
                    </summary>
                    <ActionForm
                      action={rateShop}
                      submitLabel={t('corders.submit')}
                      successMessage={t('corders.thanks')}
                      hidden={{ orderId: order.id }}
                      className="mt-3"
                    >
                      <div className="space-y-2.5">
                        <Field label={t('corders.howWasIt')}>
                          <select name="overallRating" defaultValue={5} className={inputClass}>
                            <option value={5}>{t('corders.r5')}</option>
                            <option value={4}>{t('corders.r4')}</option>
                            <option value={3}>{t('corders.r3')}</option>
                            <option value={2}>{t('corders.r2')}</option>
                            <option value={1}>{t('corders.r1')}</option>
                          </select>
                        </Field>
                        <Field label={t('corders.comment')}>
                          <input
                            name="comment"
                            placeholder={t('corders.commentPlaceholder')}
                            className={inputClass}
                          />
                        </Field>
                      </div>
                    </ActionForm>
                  </details>
                )}

                {order.status === ConsumerOrderStatus.OUT_FOR_DELIVERY && (
                  <div className="mt-3 text-[11px] text-[#636E72]">
                    {t('corders.rider', { phone: order.shopkeeper.phone ?? '' })}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      <div className="mt-6 text-center">
        <Link href="/shop" className="text-[11px] font-semibold text-agri-900 hover:underline">
          {t('corders.browse')}
        </Link>
      </div>
    </div>
  );
}
