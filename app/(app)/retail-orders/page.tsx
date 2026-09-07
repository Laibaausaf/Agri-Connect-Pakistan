import { ConsumerOrderStatus } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { requireCapability } from '@/lib/authz';
import { updateConsumerOrderStatus } from '@/lib/actions/retail';
import ActionForm from '@/components/ui/ActionForm';
import {
  Badge,
  Card,
  EmptyState,
  PageHeader,
  StatCard,
  humanStatus,
  money,
  qty,
} from '@/components/ui/kit';

export const dynamic = 'force-dynamic';

const NEXT_STEP: Partial<Record<ConsumerOrderStatus, { status: ConsumerOrderStatus; label: string }>> =
  {
    PLACED: { status: ConsumerOrderStatus.CONFIRMED, label: 'Accept order' },
    CONFIRMED: { status: ConsumerOrderStatus.PREPARING, label: 'Start packing' },
    PREPARING: { status: ConsumerOrderStatus.OUT_FOR_DELIVERY, label: 'Send out for delivery' },
    OUT_FOR_DELIVERY: { status: ConsumerOrderStatus.DELIVERED, label: 'Mark delivered' },
  };

const OPEN: ConsumerOrderStatus[] = [
  ConsumerOrderStatus.PLACED,
  ConsumerOrderStatus.CONFIRMED,
  ConsumerOrderStatus.PREPARING,
  ConsumerOrderStatus.OUT_FOR_DELIVERY,
];

export default async function RetailOrdersPage() {
  const user = await requireCapability('shopkeeper.orders.fulfill');

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
          listing: { select: { title: true, crop: { select: { name: true } } } },
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
        title="Customer Orders"
        titleUrdu="گاہک آرڈرز"
        subtitle="Orders from customers nearby. Move each one along as you pack and send it out."
      />

      <div className="grid grid-cols-3 gap-3 mb-4">
        <StatCard label="To fulfil" value={String(live.length)} tone={live.length ? 'warn' : 'default'} />
        <StatCard label="Delivered" value={String(delivered)} />
        <StatCard label="Today's takings" value={money(todayRevenue)} tone="accent" />
      </div>

      {orders.length === 0 ? (
        <EmptyState
          title="No customer orders yet"
          message="Once your storefront has live listings, orders from customers within your delivery radius land here."
          actionHref="/storefront"
          actionLabel="Open My Storefront"
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
                      <span className="text-sm font-bold text-charcoal">{order.consumer.name}</span>
                      <Badge tone={order.status === ConsumerOrderStatus.PLACED ? 'amber' : 'green'}>
                        {humanStatus(order.status)}
                      </Badge>
                    </div>
                    <div className="text-[11px] text-[#636E72] font-mono mt-0.5">
                      {order.orderNumber}
                    </div>
                    <div className="text-[11px] text-[#636E72]">
                      {order.consumer.phone} ·{' '}
                      {order.deliveryAddress ?? 'No address given — call the customer'}
                    </div>
                  </div>
                  <div className="text-right whitespace-nowrap">
                    <div className="text-sm font-bold text-agri-900">{money(order.totalAmount)}</div>
                    <div className="text-[10px] text-[#636E72]">
                      {order.deliveryFee > 0 ? `incl. ${money(order.deliveryFee)} delivery` : 'free delivery'}
                    </div>
                    <div className="text-[10px] text-[#636E72]">~{order.etaMinutes} min ETA</div>
                  </div>
                </div>

                <div className="mt-3 pt-3 border-t border-[#E5E7EB] space-y-1.5">
                  {order.items.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between gap-2 text-[11px]"
                    >
                      <span className="text-charcoal truncate">
                        {item.listing.title} · {qty(item.quantityKg)} at {money(item.pricePerKg)}/kg
                      </span>
                      <span className="font-semibold text-charcoal whitespace-nowrap">
                        {money(item.lineTotal)}
                      </span>
                    </div>
                  ))}
                </div>

                <div className="mt-3 pt-3 border-t border-[#E5E7EB] flex items-center gap-2 flex-wrap">
                  {next && (
                    <ActionForm
                      action={updateConsumerOrderStatus}
                      submitLabel={next.label}
                      variant="inline"
                      hidden={{ orderId: order.id, status: next.status }}
                    />
                  )}
                  {order.status === ConsumerOrderStatus.PLACED && (
                    <ActionForm
                      action={updateConsumerOrderStatus}
                      submitLabel="Cancel"
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
              <h2 className="text-[11px] font-bold uppercase tracking-wider text-[#636E72] mb-2">
                Closed orders
              </h2>
              <Card padded={false}>
                <div className="divide-y divide-[#E5E7EB]">
                  {done.map((order) => (
                    <div
                      key={order.id}
                      className="p-3 flex items-center justify-between gap-3 text-[11px]"
                    >
                      <div className="min-w-0">
                        <div className="font-semibold text-charcoal truncate">
                          {order.consumer.name} ·{' '}
                          {order.items.map((i) => i.listing.crop.name).join(', ')}
                        </div>
                        <div className="text-[#636E72] font-mono">{order.orderNumber}</div>
                      </div>
                      <div className="text-right whitespace-nowrap">
                        <div className="font-semibold text-charcoal">{money(order.totalAmount)}</div>
                        <Badge tone={order.status === ConsumerOrderStatus.DELIVERED ? 'green' : 'red'}>
                          {humanStatus(order.status)}
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
