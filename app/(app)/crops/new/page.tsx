import { prisma } from '@/lib/prisma';
import { requireCapability } from '@/lib/authz';
import { createCropBatch } from '@/lib/actions/crops';
import ActionForm, { Field, inputClass } from '@/components/ui/ActionForm';
import { Card, PageHeader } from '@/components/ui/kit';

export const dynamic = 'force-dynamic';

const GRADES = ['Grade A', 'Grade B', 'Grade C'];
const PROVINCES = ['Khyber Pakhtunkhwa', 'Punjab', 'Sindh', 'Balochistan', 'Islamabad Capital Territory'];

export default async function NewCropBatchPage() {
  const user = await requireCapability('farmer.batch.manage');

  const [crops, profile, account] = await Promise.all([
    prisma.crop.findMany({ where: { isActive: true }, orderBy: { name: 'asc' } }),
    prisma.farmerProfile.findUnique({ where: { userId: user.id } }),
    prisma.user.findUnique({ where: { id: user.id }, select: { location: true } }),
  ]);

  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="max-w-xl mx-auto">
      <PageHeader
        title="Add Crop Batch"
        titleUrdu="نئی فصل"
        subtitle="Record your harvest. Arhtis will send you price offers — the destination mandi is decided in that offer, not here."
      />

      <Card>
        <ActionForm action={createCropBatch} submitLabel="Save Crop Batch" submitLabelUrdu="محفوظ کریں">
          <div className="space-y-3">
            <Field label="Crop" labelUrdu="فصل">
              <select name="cropId" required className={inputClass} defaultValue="">
                <option value="" disabled>
                  Select a crop
                </option>
                {crops.map((crop) => (
                  <option key={crop.id} value={crop.id}>
                    {crop.name}
                    {crop.nameUrdu ? ` — ${crop.nameUrdu}` : ''}
                  </option>
                ))}
              </select>
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Variety" labelUrdu="قسم" hint="Optional">
                <input name="variety" className={inputClass} placeholder="Roma, Desi…" />
              </Field>
              <Field label="Grade" labelUrdu="درجہ">
                <select name="grade" required className={inputClass} defaultValue="Grade A">
                  {GRADES.map((g) => (
                    <option key={g} value={g}>
                      {g}
                    </option>
                  ))}
                </select>
              </Field>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Quantity (kg)" labelUrdu="مقدار">
                <input name="quantityKg" type="number" min="1" step="1" required className={inputClass} />
              </Field>
              <Field label="Asking price (Rs/kg)" labelUrdu="مطلوبہ قیمت" hint="Optional — leave blank to invite offers">
                <input name="askingPricePerKg" type="number" min="1" step="0.5" className={inputClass} />
              </Field>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Village" labelUrdu="گاؤں">
                <input name="originVillage" className={inputClass} defaultValue={profile?.village ?? ''} />
              </Field>
              <Field label="City / Tehsil" labelUrdu="شہر">
                <input name="originCity" required className={inputClass} defaultValue={account?.location ?? 'Swabi'} />
              </Field>
            </div>

            <Field label="Province" labelUrdu="صوبہ">
              <select name="originProvince" required className={inputClass} defaultValue="Khyber Pakhtunkhwa">
                {PROVINCES.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Harvest date" labelUrdu="کٹائی">
                <input name="harvestDate" type="date" required className={inputClass} defaultValue={today} />
              </Field>
              <Field label="Ready for pickup" labelUrdu="تیاری" hint="Optional">
                <input name="readyDate" type="date" className={inputClass} />
              </Field>
            </div>

            <Field label="Packaging" labelUrdu="پیکنگ" hint="Optional, e.g. 20 kg crates">
              <input name="packaging" className={inputClass} placeholder="20 kg plastic crates" />
            </Field>

            <Field
              label="Crop photos"
              labelUrdu="تصاویر"
              hint="Paste one or more image URLs, comma separated. These travel with the produce down the chain."
            >
              <textarea name="photos" rows={2} className={inputClass} />
            </Field>

            <Field label="Notes" labelUrdu="تفصیل" hint="Optional">
              <textarea name="notes" rows={2} className={inputClass} />
            </Field>
          </div>
        </ActionForm>
      </Card>
    </div>
  );
}
