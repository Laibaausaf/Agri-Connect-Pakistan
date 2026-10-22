import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { requireCapability } from '@/lib/authz';
import { createDemandRequest } from '@/lib/actions/sourcing';
import ActionForm, { Field, inputClass } from '@/components/ui/ActionForm';
import { Card, PageHeader } from '@/components/ui/kit';
import { getI18n } from '@/lib/i18n/server';

export const dynamic = 'force-dynamic';

const GRADES = ['Grade A', 'Grade B', 'Grade C'];

export default async function NewDemandRequestPage() {
  const user = await requireCapability('arhti.demand.manage');
  const { t, crop, place, grade } = await getI18n();

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
        title={t('demandNew.title')}
        subtitle={t('demandNew.subtitle')}
        action={
          <Link href="/demand" className="text-[11px] font-semibold text-agri-900 hover:underline">
            {t('demandNew.cancel')}
          </Link>
        }
      />

      <Card>
        <ActionForm
          action={createDemandRequest}
          submitLabel={t('demandNew.publish')}
        >
          <div className="space-y-3">
            <Field label={t('demandNew.crop')}>
              <select name="cropId" required className={inputClass}>
                <option value="">{t('demandNew.selectCrop')}</option>
                {crops.map((item) => (
                  <option key={item.id} value={item.id}>
                    {crop(item)}
                  </option>
                ))}
              </select>
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label={t('demandNew.min')}>
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
              <Field label={t('demandNew.max')}>
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
              <Field label={t('demandNew.rateFrom')}>
                <input
                  type="number"
                  name="targetPriceMin"
                  min="1"
                  step="0.5"
                  className={inputClass}
                  placeholder="70"
                />
              </Field>
              <Field label={t('demandNew.rateTo')}>
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

            <Field label={t('demandNew.grade')}>
              <select name="gradeWanted" className={inputClass}>
                <option value="">{t('demandNew.anyGrade')}</option>
                {GRADES.map((value) => (
                  <option key={value} value={value}>
                    {grade(value)}
                  </option>
                ))}
              </select>
            </Field>

            <Field
              label={t('demandNew.origins')}
              hint={t('demandNew.originsHint')}
            >
              <input name="preferredOrigins" className={inputClass} placeholder="Swabi, Mardan" dir="ltr" />
            </Field>

            <Field label={t('demandNew.neededBy')}>
              <input
                type="date"
                name="neededBy"
                required
                defaultValue={defaultNeededBy}
                className={inputClass}
              />
            </Field>

            <Field label={t('demandNew.deliverTo')}>
              <select
                name="mandiId"
                required
                defaultValue={profile?.mandiId ?? ''}
                className={inputClass}
              >
                <option value="">{t('common.selectMandi')}</option>
                {mandis.map((mandi) => (
                  <option key={mandi.id} value={mandi.id}>
                    {place(mandi.name)}
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
              {t('demandNew.transport')}
            </label>

            <Field label={t('demandNew.notes')}>
              <input
                name="notes"
                className={inputClass}
                placeholder={t('demandNew.notesPlaceholder')}
              />
            </Field>
          </div>
        </ActionForm>
      </Card>
    </div>
  );
}
