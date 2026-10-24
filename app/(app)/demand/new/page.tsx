import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { requireCapability } from '@/lib/authz';
import { createDemandRequest } from '@/lib/actions/sourcing';
import ActionForm, { Field, inputClass } from '@/components/ui/ActionForm';
import { PageHeader } from '@/components/ui/kit';
import Icon from '@/components/ui/Icon';
import { getI18n } from '@/lib/i18n/server';

export const dynamic = 'force-dynamic';

const GRADES = ['Grade A', 'Grade B', 'Grade C'];

export default async function NewDemandRequestPage() {
  const user = await requireCapability('arhti.demand.manage');
  const { t, crop, place, grade, nav } = await getI18n();
  const unit = (label: string) => (
    <span className="pointer-events-none absolute end-4 top-1/2 -translate-y-1/2 text-sm font-semibold text-muted">{label}</span>
  );
  const field = 'field-input bg-paper';

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
    <div className="mx-auto max-w-xl">
      <Link href="/demand" className="mb-2 inline-flex min-h-12 items-center gap-1.5 text-[15px] font-bold">
        <Icon name="arrowleft" size={20} />
        {nav('My Buy Requests')}
      </Link>
      <PageHeader title={t('demandNew.title')} subtitle={t('demandNew.subtitle')} />

      <ActionForm action={createDemandRequest} submitLabel={t('demandNew.publish')} icon="send">
        <div className="card space-y-5 p-5">
          <Field label={t('demandNew.crop')}>
            <select name="cropId" required className={field}>
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
              <span className="relative block">
                <input type="number" name="minQuantityKg" required min="1" step="50" className={`${field} pe-12`} placeholder="2000" />
                {unit(t('wizard.kgUnit'))}
              </span>
            </Field>
            <Field label={t('demandNew.max')}>
              <span className="relative block">
                <input type="number" name="maxQuantityKg" required min="1" step="50" className={`${field} pe-12`} placeholder="8000" />
                {unit(t('wizard.kgUnit'))}
              </span>
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label={t('demandNew.rateFrom')}>
              <span className="relative block">
                <input type="number" name="targetPriceMin" min="1" step="0.5" className={`${field} pe-24`} placeholder="70" />
                {unit(t('wizard.ownPricePlaceholder'))}
              </span>
            </Field>
            <Field label={t('demandNew.rateTo')}>
              <span className="relative block">
                <input type="number" name="targetPriceMax" min="1" step="0.5" className={`${field} pe-24`} placeholder="80" />
                {unit(t('wizard.ownPricePlaceholder'))}
              </span>
            </Field>
          </div>

          <Field label={t('demandNew.grade')}>
            <select name="gradeWanted" className={field}>
              <option value="">{t('demandNew.anyGrade')}</option>
              {GRADES.map((value) => (
                <option key={value} value={value}>
                  {grade(value)}
                </option>
              ))}
            </select>
          </Field>

          <Field label={t('demandNew.origins')} hint={t('demandNew.originsHint')}>
            <input name="preferredOrigins" className={field} placeholder="Swabi, Mardan" dir="ltr" />
          </Field>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={t('demandNew.neededBy')}>
              <input type="date" name="neededBy" required defaultValue={defaultNeededBy} className={field} />
            </Field>
            <Field label={t('demandNew.deliverTo')}>
              <select name="mandiId" required defaultValue={profile?.mandiId ?? ''} className={field}>
                <option value="">{t('common.selectMandi')}</option>
                {mandis.map((mandi) => (
                  <option key={mandi.id} value={mandi.id}>
                    {place(mandi.name)}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <label className="flex min-h-12 cursor-pointer items-center gap-3 rounded-2xl bg-sage px-4 text-[15px] font-semibold">
            <input type="checkbox" name="transportOffered" defaultChecked className="h-5 w-5 accent-[var(--fo)]" />
            {t('demandNew.transport')}
          </label>

          <Field label={t('demandNew.notes')}>
            <input name="notes" className={field} placeholder={t('demandNew.notesPlaceholder')} />
          </Field>
        </div>
      </ActionForm>

      <Link href="/demand" className="mt-3 flex min-h-12 items-center justify-center gap-1.5 text-[15px] font-bold text-muted">
        <Icon name="x" size={18} />
        {t('demandNew.cancel')}
      </Link>
    </div>
  );
}
