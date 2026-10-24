import { ConsumerOrderStatus } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { requireCapability } from '@/lib/authz';
import { updateConsumerOrderStatus } from '@/lib/actions/retail';
import ActionForm from '@/components/ui/ActionForm';
import { getI18n } from '@/lib/i18n/server';
import {
  Badge,
  Card,
  EmptyState,
  PageHeader,
  StatCard,
} from '@/components/ui/kit';

export const dynamic = 'force-dynamic';

type StepLabel = 'rorders.accept' | 'rorders.pack' | 'rorders.send' | 'rorders.deliver';

const NEXT_STEP: Partial<Record<ConsumerOrderStatus, { status: ConsumerOrderStatus; label: StepLabel }>> =
  {
    PLACED: { status: ConsumerOrderStatus.CONFIRMED, label: 'rorders.accept' },
    CONFIRMED: { status: ConsumerOrderStatus.PREPARING, label: 'rorders.pack' },
    PREPARING: { status: ConsumerOrderStatus.OUT_FOR_DELIVERY, label: 'rorders.send' },
    OUT_FOR_DELIVERY: { status: ConsumerOrderStatus.DELIVERED, label: 'rorders.deliver' },
  };

const OPEN: ConsumerOrderStatus[] = [
  ConsumerOrderStatus.PLACED,
  ConsumerOrderStatus.CONFIRMED,
  ConsumerOrderStatus.PREPARING,
  ConsumerOrderStatus.OUT_FOR_DELIVERY,
];

export default async function RetailOrdersPage() {
  const user = await requireCapability('shopkeeper.orders.fulfill');
  const { t, crop, status, kg, perKg, money } = await getI18n();

  const orders = await prisma.consumerOrder.findMany({
    where: { shopkeeperId: user.id },
    include: {
      consumer: { select: { name: true, phone: true } },
      items: {
        select: {
          id: true,
          quantityKg: true,
          pricePerKg: true,
          lineTotal: true,
          listing: { select: { title: true, crop: { select: { name: true, nameUrdu: true } } } },
        },
      },
    },
    orderBy: { placedAt: 'desc' },
    take: 40,
  });

  const live = orders.filter((o) => OPEN.includes(o.status));
  const done = orders.filter((o) => !OPEN.includes(o.status));
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayRevenue = orders
    .filter((o) => o.placedAt >= todayStart && o.status !== ConsumerOrderStatus.CANCELLED)
    .reduce((sum, o) => sum + o.totalAmount, 0);
  const delivered = orders.filter((o) => o.status === ConsumerOrderStatus.DELIVERED).length;

  return (
    <div className="max-w-3xl mx-auto">
      <PageHeader
        title={t('rorders.title')}
        subtitle={t('rorders.subtitle')}
      />

      <div className="grid grid-cols-3 gap-3 mb-4">
        <StatCard label={t('rorders.statToFulfil')} value={String(live.length)} tone={live.length ? 'warn' : 'default'} />
        <StatCard label={t('rorders.statDelivered')} value={String(delivered)} />
        <StatCard label={t('rorders.statToday')} value={money(todayRevenue)} tone="accent" />
      </div>

      {orders.length === 0 ? (
        <EmptyState
          title={t('rorders.emptyTitle')}
          message={t('rorders.emptyMessage')}
          actionHref="/storefront"
          actionLabel={t('rorders.emptyAction')}
        />
      ) : (
        <div className="space-y-3">
          {live.map((order) => {
            const next = NEXT_STEP[order.status];
            return (
              <Card key={order.id}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[17px] font-bold text-ink">{order.consumer.name}</span>
                      <Badge tone={order.status === ConsumerOrderStatus.PLACED ? 'amber' : 'green'}>
                        {status(order.status)}
                      </Badge>
                    </div>
                    <div className="text-[13px] text-muted font-mono mt-0.5">
                      {order.orderNumber}
                    </div>
                    <div className="text-[13px] text-muted">
                      {order.consumer.phone} ·{' '}
                      {order.deliveryAddress ?? t('rorders.noAddress')}
                    </div>
                  </div>
                  <div className="text-end whitespace-nowrap">
                    <div className="text-sm font-bold text-forest">{money(order.totalAmount)}</div>
                    <div className="text-[12.5px] text-muted">
                      {order.deliveryFee > 0 ? t('rorders.inclDelivery', { amount: money(order.deliveryFee) }) : t('rorders.freeDelivery')}
                    </div>
                    <div className="text-[12.5px] text-muted">{t('rorders.eta', { count: order.etaMinutes })}</div>
                  </div>
                </div>

                <div className="mt-3 pt-3 border-t border-line space-y-1.5">
                  {order.items.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between gap-2 text-[13px]"
                    >
                      <span className="text-ink truncate">
                        {t('rorders.itemLine', { title: item.listing.title, qty: kg(item.quantityKg), rate: perKg(item.pricePerKg) })}
                      </span>
                      <span className="font-semibold text-ink whitespace-nowrap">
                        {money(item.lineTotal)}
                      </span>
                    </div>
                  ))}
                </div>

                <div className="mt-3 pt-3 border-t border-line flex items-center gap-2 flex-wrap">
                  {next && (
                    <ActionForm
                      action={updateConsumerOrderStatus}
                      submitLabel={t(next.label)}
                      variant="inline"
                      hidden={{ orderId: order.id, status: next.status }}
                    />
                  )}
                  {order.status === ConsumerOrderStatus.PLACED && (
                    <ActionForm
                      action={updateConsumerOrderStatus}
                      submitLabel={t('rorders.cancel')}
                      variant="secondary"
                      hidden={{ orderId: order.id, status: ConsumerOrderStatus.CANCELLED }}
                    />
                  )}
                </div>
              </Card>
            );
          })}

          {done.length > 0 && (
            <div className="pt-2">
              <h2 className="text-[13px] font-bold uppercase tracking-[.08em] text-muted mb-2">
                {t('rorders.closed')}
              </h2>
              <Card padded={false}>
                <div className="divide-y divide-line">
                  {done.map((order) => (
                    <div
                      key={order.id}
                      className="p-3 flex items-center justify-between gap-3 text-[13px]"
                    >
                      <div className="min-w-0">
                        <div className="font-semibold text-ink truncate">
                          {order.consumer.name} ·{' '}
                          {order.items.map((i) => crop(i.listing.crop)).join(t('common.listSep'))}
                        </div>
                        <div className="text-muted font-mono">{order.orderNumber}</div>
                      </div>
                      <div className="text-end whitespace-nowrap">
                        <div className="font-semibold text-ink">{money(order.totalAmount)}</div>
                        <Badge tone={order.status === ConsumerOrderStatus.DELIVERED ? 'green' : 'red'}>
                          {status(order.status)}
                        </Badge>
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
