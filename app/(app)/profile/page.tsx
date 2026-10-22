import { UserRole } from '@prisma/client';
import { getMyProfile, getMyTrust, updateProfile } from '@/lib/actions/profile';
import ActionForm, { Field, inputClass } from '@/components/ui/ActionForm';
import { Badge, Card, PageHeader, StatCard, statusTone } from '@/components/ui/kit';
import { getI18n } from '@/lib/i18n/server';

export const dynamic = 'force-dynamic';

export default async function ProfilePage() {
  const [user, trust] = await Promise.all([getMyProfile(), getMyTrust()]);
  const { t, role, accountStatus, place, date } = await getI18n();

  const farmer = user.farmerProfile;
  const arhti = user.arhtiProfile;
  const vendor = user.vendorProfile;
  const shop = user.shopkeeperProfile;
  const consumer = user.consumerProfile;

  return (
    <div className="max-w-2xl mx-auto">
      <PageHeader
        title={t('profile.title')}
        subtitle={t(`profile.blurb.${user.role}` as 'profile.blurb.FARMER')}
      />

      <Card className="mb-4">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-bold text-charcoal">{user.name}</span>
              <Badge tone="green">{role(user.role)}</Badge>
              <Badge tone={statusTone(user.status)}>{accountStatus(user.status)}</Badge>
            </div>
            <div className="text-[11px] text-[#636E72] mt-1" dir="ltr">
              {user.email}
              {user.phone ? ` · ${user.phone}` : ''}
            </div>
            <div className="text-[10px] text-[#636E72]">
              {t('profile.memberSince', { date: date(user.createdAt, { month: 'long', year: 'numeric' }) })}
              {arhti?.mandi ? ` · ${t('profile.tradesAt', { mandi: place(arhti.mandi.name) })}` : ''}
            </div>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 mb-4">
        <StatCard
          label={t('profile.rating')}
          value={trust.average ? `${trust.average.toFixed(1)}★` : '—'}
          hint={trust.count ? t('profile.reviews', { count: trust.count }) : t('profile.noReviews')}
          tone="accent"
        />
        <StatCard label={t('profile.accountRole')} value={role(user.role)} hint={t('profile.oneRole')} />
        <StatCard label={t('profile.status')} value={accountStatus(user.status)} hint={t('profile.statusHint')} />
      </div>

      <Card className="mb-4">
        <h2 className="text-xs font-bold text-charcoal mb-3">{t('profile.edit')}</h2>
        <ActionForm
          action={updateProfile}
          submitLabel={t('common.save')}
          successMessage={t('profile.updated')}
        >
          <div className="space-y-3">
            <Field label={t('profile.fullName')}>
              <input name="name" required defaultValue={user.name} className={inputClass} />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label={t('profile.phone')}>
                <input name="phone" defaultValue={user.phone ?? ''} className={inputClass} dir="ltr" />
              </Field>
              <Field label={t('profile.location')}>
                <input name="location" defaultValue={user.location ?? ''} className={inputClass} />
              </Field>
            </div>

            {user.role === UserRole.FARMER && (
              <>
                <Field label={t('profile.farmName')}>
                  <input name="businessName" defaultValue={farmer?.businessName ?? ''} className={inputClass} />
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label={t('profile.village')}>
                    <input name="village" defaultValue={farmer?.village ?? ''} className={inputClass} />
                  </Field>
                  <Field label={t('profile.farmArea')}>
                    <input
                      name="farmAreaAcres"
                      type="number"
                      step="0.5"
                      min="0"
                      defaultValue={farmer?.farmAreaAcres ?? ''}
                      className={inputClass}
                    />
                  </Field>
                </div>
              </>
            )}

            {user.role === UserRole.ARHTI && (
              <>
                <Field label={t('profile.firmName')}>
                  <input name="businessName" defaultValue={arhti?.businessName ?? ''} className={inputClass} />
                </Field>
                <Field
                  label={t('profile.licence')}
                  hint={t('profile.commission', { rate: ((arhti?.commissionRate ?? 0.02) * 100).toFixed(1) })}
                >
                  <input name="licenseNumber" defaultValue={arhti?.licenseNumber ?? ''} className={inputClass} />
                </Field>
              </>
            )}

            {user.role === UserRole.VENDOR && (
              <>
                <Field label={t('profile.businessName')}>
                  <input name="businessName" defaultValue={vendor?.businessName ?? ''} className={inputClass} />
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label={t('profile.warehouseCity')}>
                    <input name="warehouseCity" defaultValue={vendor?.warehouseCity ?? ''} className={inputClass} />
                  </Field>
                  <Field label={t('profile.minOrder')}>
                    <input
                      name="minOrderKg"
                      type="number"
                      min="1"
                      defaultValue={vendor?.minOrderKg ?? 50}
                      className={inputClass}
                    />
                  </Field>
                </div>
                <Field label={t('profile.warehouseAddress')}>
                  <input
                    name="warehouseAddress"
                    defaultValue={vendor?.warehouseAddress ?? ''}
                    className={inputClass}
                  />
                </Field>
              </>
            )}

            {user.role === UserRole.SHOPKEEPER && (
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
                  <input
                    name="deliveryRadiusKm"
                    type="number"
                    step="0.5"
                    min="0.5"
                    max="50"
                    defaultValue={shop?.deliveryRadiusKm ?? 4}
                    className={inputClass}
                  />
                </Field>
              </>
            )}

            {user.role === UserRole.CONSUMER && (
              <>
                <Field label={t('profile.deliveryAddress')}>
                  <input
                    name="deliveryAddress"
                    defaultValue={consumer?.deliveryAddress ?? ''}
                    className={inputClass}
                  />
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label={t('profile.city')}>
                    <input name="preferredCity" defaultValue={consumer?.preferredCity ?? ''} className={inputClass} />
                  </Field>
                  <Field label={t('profile.householdSize')}>
                    <input
                      name="householdSize"
                      type="number"
                      min="1"
                      max="30"
                      defaultValue={consumer?.householdSize ?? 4}
                      className={inputClass}
                    />
                  </Field>
                </div>
              </>
            )}
          </div>
        </ActionForm>
      </Card>

      {trust.recent.length > 0 && (
        <Card>
          <h2 className="text-xs font-bold text-charcoal mb-3">{t('profile.othersSay')}</h2>
          <div className="space-y-2">
            {trust.recent.map((rating) => (
              <div key={rating.id} className="rounded-xl border border-[#E5E7EB] p-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-semibold text-charcoal">
                    {'★'.repeat(rating.overallRating)}
                    <span className="text-[#E5E7EB]">{'★'.repeat(5 - rating.overallRating)}</span>
                  </span>
                  <Badge tone="neutral">{role(rating.rater.role)}</Badge>
                  <span className="text-[10px] text-[#636E72]">
                    {date(rating.createdAt)}
                  </span>
                </div>
                {rating.comment && <p className="text-[11px] text-[#636E72] mt-1">{rating.comment}</p>}
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
