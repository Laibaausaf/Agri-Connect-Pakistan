import Link from 'next/link';
import { AccountStatus, UserRole } from '@prisma/client';
import { requireCapability } from '@/lib/authz';
import { getAdminStats, getAdminUsers, getAdminMandis, toggleUserStatus, resetDemoData } from '@/lib/actions/admin';
import ActionForm, { Field, inputClass } from '@/components/ui/ActionForm';
import { getI18n } from '@/lib/i18n/server';
import type { I18n } from '@/lib/i18n';
import { Badge, Card, PageHeader, StatCard } from '@/components/ui/kit';

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
    { label: t('admin.stageMandi'), value: stats.mandiTradeValue, hint: kg(stats.mandiVolumeKg) },
    { label: t('admin.stageWholesale'), value: stats.wholesaleTradeValue, hint: kg(stats.wholesaleVolumeKg) },
    { label: t('admin.stageRetail'), value: stats.retailTradeValue, hint: t('admin.stageRetailHint') },
  ];

  return (
    <div className="max-w-5xl mx-auto">
      <PageHeader
        title={t('admin.title')}
        subtitle={t('admin.subtitle')}
        action={
          <Link
            href="/admin/trace"
            className="bg-agri-900 hover:bg-agri-800 text-white text-[11px] font-semibold px-3 py-2 rounded-xl whitespace-nowrap"
          >
            {t('admin.trace')}
          </Link>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <StatCard label={t('admin.statAccounts')} value={String(stats.totalUsers)} />
        <StatCard label={t('admin.statBatches')} value={String(stats.totalBatches)} hint={kg(stats.harvestVolumeKg)} />
        <StatCard label={t('admin.statAuctions')} value={String(stats.liveAuctions)} tone="accent" />
        <StatCard label={t('admin.statDeals')} value={String(stats.openDeals)} tone={stats.openDeals ? 'warn' : 'default'} />
      </div>

      <Card className="mb-4">
        <h2 className="text-xs font-bold text-charcoal mb-3">{t('admin.valueByStage')}</h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {stages.map((stage) => (
            <div key={stage.label}>
              <div className="text-[10px] uppercase tracking-wider text-[#636E72] font-bold">
                {stage.label}
              </div>
              <div className="text-base font-bold text-charcoal mt-0.5">{money(stage.value)}</div>
              <div className="text-[10px] text-[#636E72]">{stage.hint}</div>
            </div>
          ))}
        </div>
      </Card>

      <Card className="mb-4">
        <h2 className="text-xs font-bold text-charcoal mb-3">{t('admin.census')}</h2>
        <div className="flex flex-wrap gap-2">
          {ROLE_ORDER.map((r) => (
            <div
              key={r}
              className="px-3 py-2 rounded-xl bg-[#F8F9F5] border border-[#E5E7EB] text-center min-w-[84px]"
            >
              <div className="text-base font-bold text-charcoal">{stats.roleCounts[r] ?? 0}</div>
              <div className="text-[10px] text-[#636E72] uppercase tracking-wide">{isUrdu ? role(r) : r}</div>
            </div>
          ))}
        </div>
      </Card>

      <Card className="mb-4">
        <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
          <h2 className="text-xs font-bold text-charcoal">{t('admin.accounts')}</h2>
          <form action="/admin" className="flex items-center gap-2">
            <input
              type="text"
              name="q"
              defaultValue={q ?? ''}
              placeholder={t('admin.searchPlaceholder')}
              className="rounded-xl border border-[#E5E7EB] px-3 py-1.5 text-[11px] focus:outline-none focus:ring-2 focus:ring-agri-700"
            />
            <button
              type="submit"
              className="text-[11px] font-semibold text-agri-900 hover:underline"
            >
              {t('admin.search')}
            </button>
            {q && (
              <Link href="/admin" className="text-[11px] text-[#636E72] hover:underline">
                {t('admin.clear')}
              </Link>
            )}
          </form>
        </div>

        <div className="divide-y divide-[#E5E7EB]">
          {users.length === 0 && (
            <div className="py-6 text-center text-[11px] text-[#636E72]">{t('admin.noMatch')}</div>
          )}
          {users.map((u) => {
            const business = businessFor(place, u);
            const suspended = u.status === AccountStatus.SUSPENDED;
            return (
              <div key={u.id} className="py-3 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-semibold text-charcoal">{u.name}</span>
                    <Badge tone="neutral">{isUrdu ? role(u.role) : u.role}</Badge>
                    <Badge tone={suspended ? 'red' : u.status === AccountStatus.VERIFIED ? 'green' : 'amber'}>
                      {isUrdu ? accountStatus(u.status) : u.status}
                    </Badge>
                  </div>
                  {business && <div className="text-[11px] text-[#636E72]">{business}</div>}
                  <div className="text-[10px] text-[#636E72]">
                    {u.email}
                    {u.phone ? ` · ${u.phone}` : ''}
                    {u.location ? ` · ${place(u.location)}` : ''}
                  </div>
                </div>
                {u.role !== UserRole.ADMIN && (
                  <ActionForm
                    action={toggleUserStatus}
                    submitLabel={suspended ? t('admin.reinstate') : t('admin.suspend')}
                    variant={suspended ? 'inline' : 'secondary'}
                    hidden={{
                      userId: u.id,
                      status: suspended ? AccountStatus.VERIFIED : AccountStatus.SUSPENDED,
                    }}
                  />
                )}
              </div>
            );
          })}
        </div>
      </Card>

      <Card className="mb-4">
        <h2 className="text-xs font-bold text-charcoal mb-3">{t('admin.mandis')}</h2>
        <div className="divide-y divide-[#E5E7EB]">
          {mandis.map((m) => (
            <div key={m.id} className="py-3 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-semibold text-charcoal">{place(m.name)}</span>
                  <Badge tone={m.isActive ? 'green' : 'neutral'}>
                    {m.isActive ? t('admin.active') : t('admin.inactive')}
                  </Badge>
                </div>
                <div className="text-[11px] text-[#636E72]">
                  {place(m.city)}{t('common.listSep')}{place(m.province)} ·{' '}
                  {m.category === 'Fruit & Vegetable Wholesale' ? t('admin.category.Fruit & Vegetable Wholesale') : m.category}
                </div>
              </div>
              <div className="text-end text-[10px] text-[#636E72] whitespace-nowrap">
                <div>
                  <span className="font-semibold text-charcoal">{m._count.arhtiProfiles}</span> {t('admin.arhtis')}
                </div>
                <div>
                  <span className="font-semibold text-charcoal">{m._count.inventoryLots}</span> {t('admin.lots')}
                </div>
                <div>
                  <span className="font-semibold text-charcoal">{m._count.auctions}</span> {t('admin.auctions')}
                </div>
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <h2 className="text-xs font-bold text-charcoal mb-1">{t('admin.resetTitle')}</h2>
        <p className="text-[11px] text-[#636E72] mb-1">
          {t('admin.resetText')}
        </p>
        <ActionForm
          action={resetDemoData}
          submitLabel={t('admin.resetSubmit')}
          variant="danger"
          successMessage={t('admin.resetDone')}
        >
          <Field label={t('admin.resetConfirm')}>
            <input name="confirm" required placeholder="RESET" className={inputClass} />
          </Field>
        </ActionForm>
      </Card>
    </div>
  );
}
