import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { requireCapability } from '@/lib/authz';
import { createDemandRequest } from '@/lib/actions/sourcing';
import ActionForm, { Field, inputClass } from '@/components/ui/ActionForm';
import { Card, PageHeader } from '@/components/ui/kit';

export const dynamic = 'force-dynamic';

const GRADES = ['Grade A', 'Grade B', 'Grade C'];

export default async function NewDemandRequestPage() {
  const user = await requireCapability('arhti.demand.manage');

  const [crops, mandis, profile] = await Promise.all([
    prisma.crop.findMany({
      where: { isActive: true },
      select: { id: true, name: true, nameUrdu: true },
      orderBy: { name: 'asc' },
    }),
    prisma.mandi.findMany({
      where: { isActive: true },
      select: { id: true, name: true },
      orderBy: { city: 'asc' },
    }),
    prisma.arhtiProfile.findUnique({
      where: { userId: user.id },
      select: { mandiId: true },
    }),
  ]);

  const nextWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  const defaultNeededBy = nextWeek.toISOString().slice(0, 10);

  return (
    <div className="max-w-xl mx-auto">
      <PageHeader
        title="Post a Buy Request"
        titleUrdu="خرید کی درخواست"
        subtitle="Farmers browse open requests to decide what to bring to the mandi. State the crop, volume and the rate band you can honour."
        action={
          <Link href="/demand" className="text-[11px] font-semibold text-agri-900 hover:underline">
            Cancel
          </Link>
        }
      />

      <Card>
        <ActionForm
          action={createDemandRequest}
          submitLabel="Publish request"
          submitLabelUrdu="شائع کریں"
        >
          <div className="space-y-3">
            <Field label="Crop" labelUrdu="فصل">
              <select name="cropId" required className={inputClass}>
                <option value="">Select crop</option>
                {crops.map((crop) => (
                  <option key={crop.id} value={crop.id}>
                    {crop.name}
                    {crop.nameUrdu ? ` — ${crop.nameUrdu}` : ''}
                  </option>
                ))}
              </select>
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Minimum quantity (kg)" labelUrdu="کم از کم">
                <input
                  type="number"
                  name="minQuantityKg"
                  required
                  min="1"
                  step="50"
                  className={inputClass}
                  placeholder="2000"
                />
              </Field>
              <Field label="Maximum quantity (kg)" labelUrdu="زیادہ سے زیادہ">
                <input
                  type="number"
                  name="maxQuantityKg"
                  required
                  min="1"
                  step="50"
                  className={inputClass}
                  placeholder="8000"
                />
              </Field>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Rate from (Rs/kg)">
                <input
                  type="number"
                  name="targetPriceMin"
                  min="1"
                  step="0.5"
                  className={inputClass}
                  placeholder="70"
                />
              </Field>
              <Field label="Rate up to (Rs/kg)">
                <input
                  type="number"
                  name="targetPriceMax"
                  min="1"
                  step="0.5"
                  className={inputClass}
                  placeholder="80"
                />
              </Field>
            </div>

            <Field label="Grade wanted">
              <select name="gradeWanted" className={inputClass}>
                <option value="">Any grade</option>
                {GRADES.map((grade) => (
                  <option key={grade} value={grade}>
                    {grade}
                  </option>
                ))}
              </select>
            </Field>

            <Field
              label="Preferred origins"
              hint="Comma separated, e.g. Swabi, Mardan, Charsadda. Leave blank for anywhere."
            >
              <input name="preferredOrigins" className={inputClass} placeholder="Swabi, Mardan" />
            </Field>

            <Field label="Needed by" labelUrdu="تاریخ">
              <input
                type="date"
                name="neededBy"
                required
                defaultValue={defaultNeededBy}
                className={inputClass}
              />
            </Field>

            <Field label="Deliver to mandi" labelUrdu="منڈی">
              <select
                name="mandiId"
                required
                defaultValue={profile?.mandiId ?? ''}
                className={inputClass}
              >
                <option value="">Select mandi</option>
                {mandis.map((mandi) => (
                  <option key={mandi.id} value={mandi.id}>
                    {mandi.name}
                  </option>
                ))}
              </select>
            </Field>

            <label className="flex items-center gap-2 text-xs text-charcoal">
              <input
                type="checkbox"
                name="transportOffered"
                defaultChecked
                className="rounded border-[#E5E7EB]"
              />
              I will arrange and pay for transport
            </label>

            <Field label="Notes for farmers">
              <input
                name="notes"
                className={inputClass}
                placeholder="Firm tomatoes only, plastic crates preferred"
              />
            </Field>
          </div>
        </ActionForm>
      </Card>
    </div>
  );
}
