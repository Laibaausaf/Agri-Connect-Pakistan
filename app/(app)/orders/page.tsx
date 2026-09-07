import Link from 'next/link';
import { ConsumerOrderStatus, TransactionType } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { requireCapability } from '@/lib/authz';
import { rateShop } from '@/lib/actions/retail';
import ActionForm, { Field, inputClass } from '@/components/ui/ActionForm';
import { Badge, Card, CropThumb, EmptyState, money, qty } from '@/components/ui/kit';
import { Clock, MapPin, Sprout, Star } from 'lucide-react';

export const dynamic = 'force-dynamic';

const STEPS: ConsumerOrderStatus[] = [
  ConsumerOrderStatus.PLACED,
  ConsumerOrderStatus.CONFIRMED,
  ConsumerOrderStatus.PREPARING,
  ConsumerOrderStatus.OUT_FOR_DELIVERY,
  ConsumerOrderStatus.DELIVERED,
];

const STEP_LABEL: Record<ConsumerOrderStatus, string> = {
  PLACED: 'Order placed',
  CONFIRMED: 'Shop confirmed',
  PREPARING: 'Being packed',
  OUT_FOR_DELIVERY: 'On the way',
  DELIVERED: 'Delivered',
  CANCELLED: 'Cancelled',
};

export default async function ConsumerOrdersPage() {
  const user = await requireCapability('consumer.orders.view');

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
          My orders <span className="text-sm font-normal text-[#636E72]">میرے آرڈرز</span>
        </h1>
        <p className="text-xs text-[#636E72] mt-0.5">
          Track a delivery, see where your food came from, and rate the shop once it arrives.
        </p>
      </div>

      {orders.length === 0 ? (
        <EmptyState
          title="No orders yet"
          message="Pick something fresh from a shop near you and it will show up here with live tracking."
          actionHref="/shop"
          actionLabel="Browse Fresh Today"
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
                        {STEP_LABEL[order.status]}
                      </Badge>
                    </div>
                    <div className="text-[11px] text-[#636E72] font-mono mt-0.5">
                      {order.orderNumber}
                    </div>
                    <div className="text-[11px] text-[#636E72] flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {order.deliveredAt
                        ? `Delivered ${order.deliveredAt.toLocaleString('en-PK', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}`
                        : `~${order.etaMinutes} min · placed ${order.placedAt.toLocaleTimeString('en-PK', { hour: '2-digit', minute: '2-digit' })}`}
                    </div>
                  </div>
                  <div className="text-right whitespace-nowrap">
                    <div className="text-sm font-bold text-agri-900">{money(order.totalAmount)}</div>
                    <div className="text-[10px] text-[#636E72]">
                      {order.deliveryFee > 0
                        ? `incl. ${money(order.deliveryFee)} delivery`
                        : 'free delivery'}
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
                          {STEP_LABEL[step]}
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
                            {qty(item.quantityKg)} at {money(item.pricePerKg)}/kg
                          </div>
                          <div className="text-[10px] text-agri-900 flex items-center gap-1">
                            <Sprout className="w-3 h-3" />
                            Grown in {farmCity}
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
                    You rated this shop {myRating}/5
                  </div>
                )}

                {canRate && (
                  <details className="mt-3 pt-3 border-t border-[#E5E7EB]">
                    <summary className="text-[11px] font-semibold text-agri-900 cursor-pointer">
                      Rate this shop
                    </summary>
                    <ActionForm
                      action={rateShop}
                      submitLabel="Submit rating"
                      submitLabelUrdu="ریٹنگ دیں"
                      successMessage="Thanks — your rating helps other buyers."
                      hidden={{ orderId: order.id }}
                      className="mt-3"
                    >
                      <div className="space-y-2.5">
                        <Field label="How was it?" labelUrdu="کیسا تھا">
                          <select name="overallRating" defaultValue={5} className={inputClass}>
                            <option value={5}>5 — Excellent</option>
                            <option value={4}>4 — Good</option>
                            <option value={3}>3 — Average</option>
                            <option value={2}>2 — Poor</option>
                            <option value={1}>1 — Bad</option>
                          </select>
                        </Field>
                        <Field label="Comment (optional)">
                          <input
                            name="comment"
                            placeholder="Fresh and on time"
                            className={inputClass}
                          />
                        </Field>
                      </div>
                    </ActionForm>
                  </details>
                )}

                {order.status === ConsumerOrderStatus.OUT_FOR_DELIVERY && (
                  <div className="mt-3 text-[11px] text-[#636E72]">
                    Rider on the way. Call the shop on {order.shopkeeper.phone} if you need to
                    redirect.
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      <div className="mt-6 text-center">
        <Link href="/shop" className="text-[11px] font-semibold text-agri-900 hover:underline">
          Browse fresh produce
        </Link>
      </div>
    </div>
  );
}
