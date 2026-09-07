import Link from 'next/link';
import { CropBatchStatus } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { requireCapability } from '@/lib/authz';
import { archiveCropBatch } from '@/lib/actions/crops';
import ActionForm from '@/components/ui/ActionForm';
import {
  Badge,
  Card,
  CropThumb,
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
    <div className="max-w-5xl mx-auto">
      <PageHeader
        title="My Crops"
        titleUrdu="میری فصلیں"
        subtitle="Record what you harvested. You do not choose a mandi here — that is agreed with an arhti when you accept a price."
        action={
          <Link
            href="/crops/new"
            className="bg-agri-900 hover:bg-agri-800 text-white text-xs font-semibold px-4 py-2 rounded-xl"
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
        <div className="space-y-3">
          {batches.map((batch) => {
            const committed = batch.quantityKg - batch.availableKg;
            return (
              <Card key={batch.id}>
                <div className="flex items-start gap-3">
                  <CropThumb imageUrl={firstPhoto(batch.photos) ?? batch.crop.imageUrl} name={batch.crop.name} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-bold text-charcoal">
                        {batch.crop.name}
                        {batch.variety ? ` • ${batch.variety}` : ''}
                      </span>
                      <Badge tone={statusTone(batch.status)}>{humanStatus(batch.status)}</Badge>
                      <Badge>{batch.grade}</Badge>
                    </div>
                    <div className="text-[11px] text-[#636E72] font-mono mt-0.5">{batch.batchNumber}</div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3 text-xs">
                      <div>
                        <div className="text-[10px] text-[#636E72]">Harvested</div>
                        <div className="font-semibold text-charcoal">{qty(batch.quantityKg)}</div>
                      </div>
                      <div>
                        <div className="text-[10px] text-[#636E72]">Uncommitted</div>
                        <div className="font-semibold text-agri-900">{qty(batch.availableKg)}</div>
                      </div>
                      <div>
                        <div className="text-[10px] text-[#636E72]">Origin</div>
                        <div className="font-semibold text-charcoal truncate">
                          {batch.originVillage ? `${batch.originVillage}, ` : ''}
                          {batch.originCity}
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] text-[#636E72]">Asking</div>
                        <div className="font-semibold text-charcoal">
                          {batch.askingPricePerKg ? `${money(batch.askingPricePerKg)}/kg` : 'Open to offers'}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 mt-3 flex-wrap text-[11px]">
                      {batch.offers.length > 0 && (
                        <Link href="/arhti-requests" className="text-agri-900 font-semibold hover:underline">
                          {batch.offers.length} pending offer{batch.offers.length === 1 ? '' : 's'} →
                        </Link>
                      )}
                      {batch.deals.map((deal) => (
                        <Link
                          key={deal.id}
                          href={`/deals/${deal.id}`}
                          className="text-[#636E72] hover:text-charcoal"
                        >
                          {deal.dealNumber} • {money(deal.agreedPricePerKg)}/kg • {humanStatus(deal.status)}
                        </Link>
                      ))}
                      {committed === 0 && (
                        <ActionForm
                          action={archiveCropBatch}
                          hidden={{ batchId: batch.id }}
                          submitLabel="Archive"
                          variant="secondary"
                          className="inline-block"
                        />
                      )}
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
