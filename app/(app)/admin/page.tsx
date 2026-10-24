import Link from 'next/link';
import { AccountStatus, UserRole } from '@prisma/client';
import { requireCapability } from '@/lib/authz';
import { getAdminStats, getAdminUsers, getAdminMandis, toggleUserStatus, resetDemoData } from '@/lib/actions/admin';
import ActionForm, { Field, inputClass } from '@/components/ui/ActionForm';
import { getI18n } from '@/lib/i18n/server';
import type { I18n } from '@/lib/i18n';
import { Badge, PageHeader } from '@/components/ui/kit';
import Icon from '@/components/ui/Icon';
import BrandGlow from '@/components/ui/BrandGlow';
import { initialsOf } from '@/lib/initials';

export const dynamic = 'force-dynamic';

const ROLE_ORDER: UserRole[] = [
  UserRole.FARMER,
  UserRole.ARHTI,
  UserRole.VENDOR,
  UserRole.SHOPKEEPER,
  UserRole.CONSUMER,
  UserRole.ADMIN,
];

function businessFor(place: I18n['place'], user: {
  role: UserRole;
  farmerProfile: { businessName: string | null; village: string | null } | null;
  arhtiProfile: { businessName: string | null; mandi: { name: string } | null } | null;
  vendorProfile: { businessName: string | null; warehouseCity: string | null } | null;
  shopkeeperProfile: { shopName: string; city: string | null } | null;
  consumerProfile: { preferredCity: string | null } | null;
}): string | null {
  switch (user.role) {
    case UserRole.FARMER:
      return user.farmerProfile?.businessName ?? (user.farmerProfile?.village ? place(user.farmerProfile.village) : null);
    case UserRole.ARHTI:
      return user.arhtiProfile
        ? [user.arhtiProfile.businessName, user.arhtiProfile.mandi ? place(user.arhtiProfile.mandi.name) : null].filter(Boolean).join(' · ') || null
        : null;
    case UserRole.VENDOR:
      return user.vendorProfile
        ? [user.vendorProfile.businessName, user.vendorProfile.warehouseCity ? place(user.vendorProfile.warehouseCity) : null].filter(Boolean).join(' · ') || null
        : null;
    case UserRole.SHOPKEEPER:
      return user.shopkeeperProfile
        ? `${user.shopkeeperProfile.shopName}${user.shopkeeperProfile.city ? ` · ${place(user.shopkeeperProfile.city)}` : ''}`
        : null;
    case UserRole.CONSUMER:
      return user.consumerProfile?.preferredCity ? place(user.consumerProfile.preferredCity) : null;
    default:
      return null;
  }
}

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  await requireCapability('admin.console');
  const { q } = await searchParams;
  const { t, isUrdu, role, accountStatus, place, kg, money } = await getI18n();

  const [stats, users, mandis] = await Promise.all([
    getAdminStats(),
    getAdminUsers(q),
    getAdminMandis(),
  ]);

  const stages = [
    { label: t('admin.stageFarmer'), value: stats.farmerPayout, hint: t('admin.stageFarmerHint') },
    {
      label: t('admin.stageMandi'),
      value: stats.mandiTradeValue,
      hint: t('admin.stageMandiHint', { qty: kg(stats.mandiVolumeKg), commission: money(stats.mandiCommission) }),
    },
    { label: t('admin.stageWholesale'), value: stats.wholesaleTradeValue, hint: kg(stats.wholesaleVolumeKg) },
    { label: t('admin.stageRetail'), value: stats.retailTradeValue, hint: t('admin.stageRetailHint') },
  ];

  const top = Math.max(...stages.map((stage) => stage.value), 1);
  const tile = (value: string, label: string, hint?: string) => (
    <div className="rounded-2xl bg-sage px-4 py-3">
      <div className="tabular text-xl font-extrabold leading-tight">{value}</div>
      <div className="text-[12.5px] font-semibold text-muted">{label}</div>
      {hint && <div className="text-[12px] text-muted">{hint}</div>}
    </div>
  );

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader
        title={t('admin.title')}
        subtitle={t('admin.subtitle')}
        action={
          <Link href="/admin/trace" className="btn btn-outline btn-sm">
            <Icon name="route" size={16} />
            {t('admin.trace')}
          </Link>
        }
      />

      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        {tile(String(stats.totalUsers), t('admin.statAccounts'))}
        {tile(String(stats.totalBatches), t('admin.statBatches'), kg(stats.harvestVolumeKg))}
        {tile(String(stats.liveAuctions), t('admin.statAuctions'))}
        {tile(String(stats.openDeals), t('admin.statDeals'))}
      </div>

      {/* Value moving through the chain: the one gradient block */}
      <section className="relative overflow-hidden rounded-hero bg-brand p-5 text-white sm:p-6">
        <BrandGlow />
        <div className="relative">
          <h2 className="text-xs font-bold uppercase tracking-[.08em] text-[#D6E6D9]">{t('admin.valueByStage')}</h2>
          <div className="mt-4 grid grid-cols-2 gap-5 lg:grid-cols-4">
            {stages.map((stage, i) => (
              <div key={stage.label}>
                <div className="text-[13px] font-bold text-[#D6E6D9]">{stage.label}</div>
                <div className={`tabular text-[24px] font-extrabold leading-tight ${i === 1 ? 'text-[#F6C871]' : ''}`}>{money(stage.value)}</div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/15" aria-hidden="true">
                  <div className={`ac-grow h-full rounded-full ${i === 1 ? 'bg-gold' : 'bg-[#9FD8B1]'}`} style={{ width: `${Math.max(4, (stage.value / top) * 100)}%` }} />
                </div>
                <div className="mt-1.5 text-[12.5px] text-[#D6E6D9]">{stage.hint}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="grid items-start gap-6 lg:grid-cols-[1.3fr_1fr]">
        <section className="card overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line p-4">
            <div>
              <h2 className="text-[17px] font-bold">{t('admin.accounts')}</h2>
              <p className="text-[12.5px] text-muted">{t('admin.shown', { shown: users.length, total: stats.totalUsers })}</p>
            </div>
            <form action="/admin" className="flex items-center gap-2">
              <span className="relative">
                <Icon name="search" size={16} className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-muted" />
                <input type="text" name="q" defaultValue={q ?? ''} placeholder={t('admin.searchPlaceholder')} className="field-input h-11 min-h-0 w-56 bg-paper ps-9 text-sm font-medium" />
              </span>
              <button type="submit" className="btn btn-secondary btn-sm">
                {t('admin.search')}
              </button>
              {q && (
                <Link href="/admin" className="inline-flex min-h-11 items-center text-[13px] text-muted hover:underline">
                  {t('admin.clear')}
                </Link>
              )}
            </form>
          </div>
          <div className="divide-y divide-line">
            {users.length === 0 && <div className="p-6 text-center text-[13px] text-muted">{t('admin.noMatch')}</div>}
            {users.map((u) => {
              const business = businessFor(place, u);
              const suspended = u.status === AccountStatus.SUSPENDED;
              return (
                <div key={u.id} className="flex items-start gap-3 p-4">
                  <span className="h-10 w-10 shrink-0 rounded-full bg-sage text-center text-sm font-extrabold leading-10 text-forest" dir="ltr">
                    {initialsOf(u.name)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[15px] font-bold">{u.name}</span>
                      <Badge tone="neutral">{isUrdu ? role(u.role) : u.role}</Badge>
                      <Badge tone={suspended ? 'red' : u.status === AccountStatus.VERIFIED ? 'green' : 'amber'}>{isUrdu ? accountStatus(u.status) : u.status}</Badge>
                    </div>
                    {business && <div className="text-[13px] text-muted">{business}</div>}
                    <div className="text-[12.5px] text-muted">
                      <span dir="ltr">{u.email}</span>
                      {u.phone && (
                        <>
                          {' · '}
                          <a href={`tel:${u.phone.replace(/[^\d+]/g, '')}`} className="underline-offset-2 hover:underline" dir="ltr">
                            {u.phone}
                          </a>
                        </>
                      )}
                      {u.location ? ` · ${place(u.location)}` : ''}
                    </div>
                  </div>
                  {u.role !== UserRole.ADMIN && (
                    <ActionForm
                      action={toggleUserStatus}
                      submitLabel={suspended ? t('admin.reinstate') : t('admin.suspend')}
                      variant="outline"
                      icon={suspended ? 'play' : 'pause'}
                      hidden={{ userId: u.id, status: suspended ? AccountStatus.VERIFIED : AccountStatus.SUSPENDED }}
                      className={`shrink-0 [&>button]:mt-0 [&>button]:min-h-10 [&>button]:px-3 [&>button]:text-sm ${suspended ? '' : '[&>button]:text-err-fg'}`}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </section>

        <div className="space-y-6">
          <section>
            <h2 className="mb-2 text-xs font-bold uppercase tracking-[.08em] text-muted">{t('admin.census')}</h2>
            <div className="grid grid-cols-3 gap-2">
              {ROLE_ORDER.map((r) => (
                <div key={r} className="rounded-2xl bg-sage px-3 py-2.5">
                  <div className="tabular text-xl font-extrabold">{stats.roleCounts[r] ?? 0}</div>
                  <div className="text-[12.5px] font-semibold text-muted">{role(r)}</div>
                </div>
              ))}
            </div>
          </section>

          <section className="card overflow-hidden">
            <h2 className="border-b border-line p-4 text-[17px] font-bold">{t('admin.mandis')}</h2>
            <div className="divide-y divide-line">
              {mandis.map((m) => (
                <div key={m.id} className="flex items-start justify-between gap-3 p-4">
                  <div className="min-w-0">
                    <div className="text-[15px] font-bold">{place(m.name)}</div>
                    <div className="text-[12.5px] text-muted">
                      {place(m.city)}
                      {t('common.listSep')}
                      {place(m.province)} · {m.category === 'Fruit & Vegetable Wholesale' ? t('admin.category.Fruit & Vegetable Wholesale') : m.category}
                    </div>
                    <div className="text-[12.5px] text-muted">
                      {m._count.arhtiProfiles} {t('admin.arhtis')} · {m._count.inventoryLots} {t('admin.lots')} · {m._count.auctions} {t('admin.auctions')}
                    </div>
                  </div>
                  <Badge tone={m.isActive ? 'green' : 'neutral'}>{m.isActive ? t('admin.active') : t('admin.inactive')}</Badge>
                </div>
              ))}
            </div>
          </section>

          {/* Danger zone */}
          <section className="rounded-hero border-[1.5px] border-err-fg bg-err-bg p-5">
            <h2 className="flex items-center gap-2 text-[17px] font-bold text-err-fg">
              <Icon name="alert" size={20} />
              {t('admin.resetTitle')}
            </h2>
            <p className="mb-3 mt-1 text-[13px]">{t('admin.resetText')}</p>
            <ActionForm action={resetDemoData} submitLabel={t('admin.resetSubmit')} variant="danger" icon="refresh" successMessage={t('admin.resetDone')}>
              <Field label={t('admin.resetConfirm')}>
                <input name="confirm" required placeholder="RESET" className={inputClass} dir="ltr" />
              </Field>
            </ActionForm>
          </section>
        </div>
      </div>
    </div>
  );
}
