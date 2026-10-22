import Link from 'next/link';
import { CropBatchStatus } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { requireCapability } from '@/lib/authz';
import { archiveCropBatch } from '@/lib/actions/crops';
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
  statusTone,
} from '@/components/ui/kit';

export const dynamic = 'force-dynamic';

function firstPhoto(photos: unknown): string | null {
  if (Array.isArray(photos) && typeof photos[0] === 'string') return photos[0];
  return null;
}

export default async function MyCropsPage() {
  const user = await requireCapability('farmer.batch.manage');

  const batches = await prisma.farmerCropBatch.findMany({
    where: { farmerId: user.id, status: { not: CropBatchStatus.ARCHIVED } },
    include: {
      crop: true,
      offers: { where: { status: 'PENDING' }, select: { id: true } },
      deals: { select: { id: true, dealNumber: true, status: true, agreedPricePerKg: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  const totalKg = batches.reduce((sum, b) => sum + b.quantityKg, 0);
  const availableKg = batches.reduce((sum, b) => sum + b.availableKg, 0);
  const soldKg = totalKg - availableKg;

  return (
    <div className="max-w-7xl mx-auto">
      <PageHeader
        title="My Crops"
        titleUrdu="میری فصلیں"
        subtitle="Record what you harvested. You do not choose a mandi here — that is agreed with an arhti when you accept a price."
        action={
          <Link
            href="/crops/new"
            className="bg-agri-900 hover:bg-agri-800 text-white text-base font-semibold px-5 py-3 rounded-xl"
          >
            + Add Crop Batch
          </Link>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        <StatCard label="Batches" value={batches.length} />
        <StatCard label="Total harvested" value={qty(totalKg)} />
        <StatCard label="Still uncommitted" value={qty(availableKg)} tone="accent" />
        <StatCard label="Committed to deals" value={qty(soldKg)} />
      </div>

      {batches.length === 0 ? (
        <EmptyState
          title="No crop batches yet"
          message="Add your harvest so arhtis in Islamabad, Rawalpindi and Peshawar can offer you a price."
          actionHref="/crops/new"
          actionLabel="Add your first batch"
        />
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {batches.map((batch) => {
            const committed = batch.quantityKg - batch.availableKg;
            const photo = firstPhoto(batch.photos) ?? batch.crop.imageUrl;
            return (
              <div
                key={batch.id}
                className="flex flex-col overflow-hidden rounded-2xl border border-[#E5E7EB] bg-white shadow-sm"
              >
                <div className="relative h-56 w-full bg-[#E8F3EE]">
                  {photo ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={photo} alt={batch.crop.name} className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full items-center justify-center text-5xl">🌾</div>
                  )}
                  <div className="absolute left-3 top-3 flex gap-2">
                    <Badge tone={statusTone(batch.status)}>{humanStatus(batch.status)}</Badge>
                    <Badge>{batch.grade}</Badge>
                  </div>
                </div>

                <div className="flex flex-1 flex-col p-5">
                  <h3 className="text-xl font-bold text-charcoal">
                    {batch.crop.name}
                    {batch.variety ? ` • ${batch.variety}` : ''}
                  </h3>
                  <div className="mt-0.5 font-mono text-xs text-[#636E72]">{batch.batchNumber}</div>

                  <div className="mt-4 text-3xl font-extrabold text-agri-900">
                    {batch.askingPricePerKg ? `${money(batch.askingPricePerKg)}/kg` : 'Open to offers'}
                    <span className="ml-2 text-sm font-medium text-[#636E72]">asking</span>
                  </div>

                  <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 text-base">
                    <div>
                      <dt className="text-sm text-[#636E72]">Harvested</dt>
                      <dd className="font-semibold text-charcoal">{qty(batch.quantityKg)}</dd>
                    </div>
                    <div>
                      <dt className="text-sm text-[#636E72]">Uncommitted</dt>
                      <dd className="font-semibold text-agri-900">{qty(batch.availableKg)}</dd>
                    </div>
                    <div className="col-span-2">
                      <dt className="text-sm text-[#636E72]">Origin</dt>
                      <dd className="font-semibold text-charcoal">
                        {batch.originVillage ? `${batch.originVillage}, ` : ''}
                        {batch.originCity}
                      </dd>
                    </div>
                  </dl>

                  <div className="mt-4 flex flex-wrap items-center gap-3 text-sm">
                    {batch.offers.length > 0 && (
                      <Link href="/arhti-requests" className="font-semibold text-agri-900 hover:underline">
                        {batch.offers.length} pending offer{batch.offers.length === 1 ? '' : 's'} →
                      </Link>
                    )}
                    {batch.deals.map((deal) => (
                      <Link key={deal.id} href={`/deals/${deal.id}`} className="text-[#636E72] hover:text-charcoal">
                        {deal.dealNumber} • {money(deal.agreedPricePerKg)}/kg • {humanStatus(deal.status)}
                      </Link>
                    ))}
                  </div>

                  {committed === 0 && (
                    <div className="mt-4">
                      <ActionForm
                        action={archiveCropBatch}
                        hidden={{ batchId: batch.id }}
                        submitLabel="Archive"
                        variant="secondary"
                        className="inline-block"
                      />
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
