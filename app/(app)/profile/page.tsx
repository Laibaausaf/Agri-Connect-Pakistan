import { UserRole } from '@prisma/client';
import { getMyProfile, getMyTrust, updateProfile } from '@/lib/actions/profile';
import ActionForm, { Field, inputClass } from '@/components/ui/ActionForm';
import { Badge, StatCard, statusTone } from '@/components/ui/kit';
import { getI18n } from '@/lib/i18n/server';
import { logout } from '@/lib/actions/auth';
import Icon from '@/components/ui/Icon';
import LanguageToggle from '@/components/layout/LanguageToggle';
import ThemeToggle from '@/components/layout/ThemeToggle';
import { initialsOf } from '@/lib/initials';

export const dynamic = 'force-dynamic';

export default async function ProfilePage() {
  const [user, trust] = await Promise.all([getMyProfile(), getMyTrust()]);
  const { t, role, accountStatus, place, date } = await getI18n();

  const farmer = user.farmerProfile;
  const arhti = user.arhtiProfile;
  const vendor = user.vendorProfile;
  const shop = user.shopkeeperProfile;
  const consumer = user.consumerProfile;

  const section = (title: string, children: React.ReactNode) => (
    <section className="card overflow-hidden">
      <h2 className="border-b border-line px-4 py-3 text-xs font-bold uppercase tracking-[.08em] text-muted">{title}</h2>
      <div className="space-y-4 p-4">{children}</div>
    </section>
  );
  const ROLE_SECTION = {"FARMER":"profile.sectionFarm","ARHTI":"profile.sectionBusiness","VENDOR":"profile.sectionBusiness","SHOPKEEPER":"profile.sectionShop","CONSUMER":"profile.sectionDelivery"} as const;
  const roleSectionTitle = user.role in ROLE_SECTION ? t(ROLE_SECTION[user.role as keyof typeof ROLE_SECTION]) : null;

  return (
    <div className="mx-auto max-w-2xl">
      <div className="ac-up mb-6 flex items-center gap-4">
        <span className="h-[72px] w-[72px] shrink-0 rounded-full bg-gold text-center text-2xl font-extrabold leading-[72px] text-ongold" dir="ltr">
          {initialsOf(user.name)}
        </span>
        <div className="min-w-0">
          <h1 className="font-display h-page truncate font-semibold">{user.name}</h1>
          <p className="text-sm text-muted">{t(`profile.blurb.${user.role}` as 'profile.blurb.FARMER')}</p>
          <div className="mt-1.5 flex flex-wrap items-center gap-2">
            <Badge tone="neutral" icon="user">{role(user.role)}</Badge>
            <Badge tone={statusTone(user.status)}>{accountStatus(user.status)}</Badge>
          </div>
        </div>
      </div>

      <section className="card mb-4 divide-y divide-line">
        <div className="flex items-center gap-3 p-4">
          <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sage text-forest">
            <Icon name="mail" size={20} />
          </span>
          <div className="min-w-0 text-[15px] font-semibold" dir="ltr">
            {user.email}
            {user.phone ? ` · ${user.phone}` : ''}
          </div>
        </div>
        <div className="flex items-center gap-3 p-4">
          <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sage text-forest">
            <Icon name="calendar" size={20} />
          </span>
          <div className="text-sm text-muted">
            {t('profile.memberSince', { date: date(user.createdAt, { month: 'long', year: 'numeric' }) })}
            {arhti?.mandi ? ` · ${t('profile.tradesAt', { mandi: place(arhti.mandi.name) })}` : ''}
          </div>
        </div>
      </section>

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-3">
        <StatCard
          label={t('profile.rating')}
          value={trust.average ? `${trust.average.toFixed(1)}★` : '—'}
          hint={trust.count ? t('profile.reviews', { count: trust.count }) : t('profile.noReviews')}
          tone="accent"
        />
        <StatCard label={t('profile.accountRole')} value={role(user.role)} hint={t('profile.oneRole')} />
        <StatCard label={t('profile.status')} value={accountStatus(user.status)} hint={t('profile.statusHint')} />
      </div>

      <h2 className="font-display h-section mb-3 font-semibold">{t('profile.edit')}</h2>
      <ActionForm action={updateProfile} submitLabel={t('common.save')} successMessage={t('profile.updated')} icon="check">
        <div className="space-y-4">
          {section(
            t('profile.sectionAccount'),
            <>
              <Field label={t('profile.fullName')}>
                <input name="name" required defaultValue={user.name} className={inputClass} />
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label={t('profile.phone')}>
                  <input name="phone" defaultValue={user.phone ?? ''} className={inputClass} dir="ltr" />
                </Field>
                <Field label={t('profile.location')}>
                  <input name="location" defaultValue={user.location ?? ''} className={inputClass} />
                </Field>
              </div>
            </>
          )}

          {user.role === UserRole.FARMER &&
            section(
              roleSectionTitle ?? '',
              <>
                <Field label={t('profile.farmName')}>
                  <input name="businessName" defaultValue={farmer?.businessName ?? ''} className={inputClass} />
                </Field>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label={t('profile.village')}>
                    <input name="village" defaultValue={farmer?.village ?? ''} className={inputClass} />
                  </Field>
                  <Field label={t('profile.farmArea')}>
                    <input name="farmAreaAcres" type="number" step="0.5" min="0" defaultValue={farmer?.farmAreaAcres ?? ''} className={inputClass} />
                  </Field>
                </div>
              </>
            )}

          {user.role === UserRole.ARHTI &&
            section(
              roleSectionTitle ?? '',
              <>
                <Field label={t('profile.firmName')}>
                  <input name="businessName" defaultValue={arhti?.businessName ?? ''} className={inputClass} />
                </Field>
                <Field label={t('profile.licence')} hint={t('profile.commission', { rate: ((arhti?.commissionRate ?? 0.02) * 100).toFixed(1) })}>
                  <input name="licenseNumber" defaultValue={arhti?.licenseNumber ?? ''} className={inputClass} />
                </Field>
              </>
            )}

          {user.role === UserRole.VENDOR &&
            section(
              roleSectionTitle ?? '',
              <>
                <Field label={t('profile.businessName')}>
                  <input name="businessName" defaultValue={vendor?.businessName ?? ''} className={inputClass} />
                </Field>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label={t('profile.warehouseCity')}>
                    <input name="warehouseCity" defaultValue={vendor?.warehouseCity ?? ''} className={inputClass} />
                  </Field>
                  <Field label={t('profile.minOrder')}>
                    <input name="minOrderKg" type="number" min="1" defaultValue={vendor?.minOrderKg ?? 50} className={inputClass} />
                  </Field>
                </div>
                <Field label={t('profile.warehouseAddress')}>
                  <input name="warehouseAddress" defaultValue={vendor?.warehouseAddress ?? ''} className={inputClass} />
                </Field>
              </>
            )}

          {user.role === UserRole.SHOPKEEPER &&
            section(
              roleSectionTitle ?? '',
              <>
                <Field label={t('profile.shopName')}>
                  <input name="shopName" required defaultValue={shop?.shopName ?? ''} className={inputClass} />
                </Field>
                <Field label={t('profile.shopAddress')}>
                  <input name="shopAddress" defaultValue={shop?.shopAddress ?? ''} className={inputClass} />
                </Field>
                <div className="grid grid-cols-3 gap-3">
                  <Field label={t('profile.city')}>
                    <input name="city" defaultValue={shop?.city ?? ''} className={inputClass} />
                  </Field>
                  <Field label={t('profile.opens')}>
                    <input name="opensAt" placeholder="07:00" defaultValue={shop?.opensAt ?? ''} className={inputClass} />
                  </Field>
                  <Field label={t('profile.closes')}>
                    <input name="closesAt" placeholder="21:00" defaultValue={shop?.closesAt ?? ''} className={inputClass} />
                  </Field>
                </div>
                <Field label={t('profile.radius')} hint={t('profile.radiusHint')}>
                  <input name="deliveryRadiusKm" type="number" step="0.5" min="0.5" max="50" defaultValue={shop?.deliveryRadiusKm ?? 4} className={inputClass} />
                </Field>
              </>
            )}

          {user.role === UserRole.CONSUMER &&
            section(
              roleSectionTitle ?? '',
              <>
                <Field label={t('profile.deliveryAddress')}>
                  <input name="deliveryAddress" defaultValue={consumer?.deliveryAddress ?? ''} className={inputClass} />
                </Field>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label={t('profile.city')}>
                    <input name="preferredCity" defaultValue={consumer?.preferredCity ?? ''} className={inputClass} />
                  </Field>
                  <Field label={t('profile.householdSize')}>
                    <input name="householdSize" type="number" min="1" max="30" defaultValue={consumer?.householdSize ?? 4} className={inputClass} />
                  </Field>
                </div>
              </>
            )}
        </div>
      </ActionForm>

      {trust.recent.length > 0 && (
        <section className="mt-8">
          <h2 className="font-display h-section mb-3 font-semibold">{t('profile.othersSay')}</h2>
          <div className="card divide-y divide-line">
            {trust.recent.map((rating) => (
              <div key={rating.id} className="p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[15px] font-bold text-goldtext" aria-label={`${rating.overallRating}/5`}>
                    {'★'.repeat(rating.overallRating)}
                    <span className="text-line">{'★'.repeat(5 - rating.overallRating)}</span>
                  </span>
                  <Badge tone="neutral">{role(rating.rater.role)}</Badge>
                  <span className="text-[13px] text-muted">{date(rating.createdAt)}</span>
                </div>
                {rating.comment && <p className="mt-1 text-sm text-muted">{rating.comment}</p>}
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="card mt-8 divide-y divide-line">
        <h2 className="px-4 py-3 text-xs font-bold uppercase tracking-[.08em] text-muted">{t('profile.appSettings')}</h2>
        <div className="flex items-center justify-between gap-3 p-4">
          <span className="flex items-center gap-3 text-[15px] font-bold">
            <Icon name="globe" size={20} />
            {t('header.languageLabel')}
          </span>
          <LanguageToggle compact tone="paper" />
        </div>
        <div className="flex items-center justify-between gap-3 p-4">
          <span className="flex items-center gap-3 text-[15px] font-bold">
            <Icon name="moon" size={20} />
            {t('profile.theme')}
          </span>
          <ThemeToggle compact tone="paper" />
        </div>
      </section>

      <form action={logout} className="mt-4">
        <button type="submit" className="btn btn-outline w-full text-err-fg">
          <Icon name="logout" size={20} />
          {t('header.logout')}
        </button>
      </form>
    </div>
  );
}
