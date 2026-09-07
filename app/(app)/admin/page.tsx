import Link from 'next/link';
import { AccountStatus, UserRole } from '@prisma/client';
import { requireCapability } from '@/lib/authz';
import { getAdminStats, getAdminUsers, getAdminMandis, toggleUserStatus, resetDemoData } from '@/lib/actions/admin';
import ActionForm, { Field, inputClass } from '@/components/ui/ActionForm';
import { Badge, Card, PageHeader, StatCard, money, qty } from '@/components/ui/kit';

export const dynamic = 'force-dynamic';

const ROLE_ORDER: UserRole[] = [
  UserRole.FARMER,
  UserRole.ARHTI,
  UserRole.VENDOR,
  UserRole.SHOPKEEPER,
  UserRole.CONSUMER,
  UserRole.ADMIN,
];

function businessFor(user: {
  role: UserRole;
  farmerProfile: { businessName: string | null; village: string | null } | null;
  arhtiProfile: { businessName: string | null; mandi: { name: string } | null } | null;
  vendorProfile: { businessName: string | null; warehouseCity: string | null } | null;
  shopkeeperProfile: { shopName: string; city: string | null } | null;
  consumerProfile: { preferredCity: string | null } | null;
}): string | null {
  switch (user.role) {
    case UserRole.FARMER:
      return user.farmerProfile?.businessName ?? user.farmerProfile?.village ?? null;
    case UserRole.ARHTI:
      return user.arhtiProfile
        ? [user.arhtiProfile.businessName, user.arhtiProfile.mandi?.name].filter(Boolean).join(' · ') || null
        : null;
    case UserRole.VENDOR:
      return user.vendorProfile
        ? [user.vendorProfile.businessName, user.vendorProfile.warehouseCity].filter(Boolean).join(' · ') || null
        : null;
    case UserRole.SHOPKEEPER:
      return user.shopkeeperProfile
        ? `${user.shopkeeperProfile.shopName}${user.shopkeeperProfile.city ? ` · ${user.shopkeeperProfile.city}` : ''}`
        : null;
    case UserRole.CONSUMER:
      return user.consumerProfile?.preferredCity ?? null;
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

  const [stats, users, mandis] = await Promise.all([
    getAdminStats(),
    getAdminUsers(q),
    getAdminMandis(),
  ]);

  const stages = [
    { label: 'Farmer payouts', value: stats.farmerPayout, hint: 'Net paid to growers' },
    { label: 'Mandi auctions', value: stats.mandiTradeValue, hint: qty(stats.mandiVolumeKg) },
    { label: 'Wholesale', value: stats.wholesaleTradeValue, hint: qty(stats.wholesaleVolumeKg) },
    { label: 'Retail', value: stats.retailTradeValue, hint: 'Paid by consumers' },
  ];

  return (
    <div className="max-w-5xl mx-auto">
      <PageHeader
        title="Admin Console"
        titleUrdu="ایڈمن پینل"
        subtitle="Network oversight across the whole chain: who is on the platform, what each mandi is moving, and how value is distributed from farm to counter."
        action={
          <Link
            href="/admin/trace"
            className="bg-agri-900 hover:bg-agri-800 text-white text-[11px] font-semibold px-3 py-2 rounded-xl whitespace-nowrap"
          >
            Supply Chain Trace
          </Link>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <StatCard label="Accounts" value={String(stats.totalUsers)} />
        <StatCard label="Crop batches" value={String(stats.totalBatches)} hint={qty(stats.harvestVolumeKg)} />
        <StatCard label="Live auctions" value={String(stats.liveAuctions)} tone="accent" />
        <StatCard label="Deals in progress" value={String(stats.openDeals)} tone={stats.openDeals ? 'warn' : 'default'} />
      </div>

      <Card className="mb-4">
        <h2 className="text-xs font-bold text-charcoal mb-3">Value by stage</h2>
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
        <h2 className="text-xs font-bold text-charcoal mb-3">Role census</h2>
        <div className="flex flex-wrap gap-2">
          {ROLE_ORDER.map((role) => (
            <div
              key={role}
              className="px-3 py-2 rounded-xl bg-[#F8F9F5] border border-[#E5E7EB] text-center min-w-[84px]"
            >
              <div className="text-base font-bold text-charcoal">{stats.roleCounts[role] ?? 0}</div>
              <div className="text-[10px] text-[#636E72] uppercase tracking-wide">{role}</div>
            </div>
          ))}
        </div>
      </Card>

      <Card className="mb-4">
        <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
          <h2 className="text-xs font-bold text-charcoal">Accounts</h2>
          <form action="/admin" className="flex items-center gap-2">
            <input
              type="text"
              name="q"
              defaultValue={q ?? ''}
              placeholder="Search name, email, city"
              className="rounded-xl border border-[#E5E7EB] px-3 py-1.5 text-[11px] focus:outline-none focus:ring-2 focus:ring-agri-700"
            />
            <button
              type="submit"
              className="text-[11px] font-semibold text-agri-900 hover:underline"
            >
              Search
            </button>
            {q && (
              <Link href="/admin" className="text-[11px] text-[#636E72] hover:underline">
                Clear
              </Link>
            )}
          </form>
        </div>

        <div className="divide-y divide-[#E5E7EB]">
          {users.length === 0 && (
            <div className="py-6 text-center text-[11px] text-[#636E72]">No accounts match.</div>
          )}
          {users.map((u) => {
            const business = businessFor(u);
            const suspended = u.status === AccountStatus.SUSPENDED;
            return (
              <div key={u.id} className="py-3 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-semibold text-charcoal">{u.name}</span>
                    <Badge tone="neutral">{u.role}</Badge>
                    <Badge tone={suspended ? 'red' : u.status === AccountStatus.VERIFIED ? 'green' : 'amber'}>
                      {u.status}
                    </Badge>
                  </div>
                  {business && <div className="text-[11px] text-[#636E72]">{business}</div>}
                  <div className="text-[10px] text-[#636E72]">
                    {u.email}
                    {u.phone ? ` · ${u.phone}` : ''}
                    {u.location ? ` · ${u.location}` : ''}
                  </div>
                </div>
                {u.role !== UserRole.ADMIN && (
                  <ActionForm
                    action={toggleUserStatus}
                    submitLabel={suspended ? 'Reinstate' : 'Suspend'}
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
        <h2 className="text-xs font-bold text-charcoal mb-3">Mandis</h2>
        <div className="divide-y divide-[#E5E7EB]">
          {mandis.map((m) => (
            <div key={m.id} className="py-3 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-semibold text-charcoal">{m.name}</span>
                  <Badge tone={m.isActive ? 'green' : 'neutral'}>
                    {m.isActive ? 'Active' : 'Inactive'}
                  </Badge>
                </div>
                <div className="text-[11px] text-[#636E72]">
                  {m.city}, {m.province} · {m.category}
                </div>
              </div>
              <div className="text-right text-[10px] text-[#636E72] whitespace-nowrap">
                <div>
                  <span className="font-semibold text-charcoal">{m._count.arhtiProfiles}</span> arhtis
                </div>
                <div>
                  <span className="font-semibold text-charcoal">{m._count.inventoryLots}</span> lots
                </div>
                <div>
                  <span className="font-semibold text-charcoal">{m._count.auctions}</span> auctions
                </div>
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <h2 className="text-xs font-bold text-charcoal mb-1">Reset demo data</h2>
        <p className="text-[11px] text-[#636E72] mb-1">
          Drops the database and re-seeds the full farm-to-counter demo chain. Everything created
          during a walkthrough is lost.
        </p>
        <ActionForm
          action={resetDemoData}
          submitLabel="Reset demo data"
          variant="danger"
          successMessage="Database re-seeded. Reload to see the fresh demo chain."
        >
          <Field label="Type RESET to confirm">
            <input name="confirm" required placeholder="RESET" className={inputClass} />
          </Field>
        </ActionForm>
      </Card>
    </div>
  );
}
