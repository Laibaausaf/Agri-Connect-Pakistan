import { UserRole } from '@prisma/client';
import { getMyProfile, getMyTrust, updateProfile } from '@/lib/actions/profile';
import ActionForm, { Field, inputClass } from '@/components/ui/ActionForm';
import { Badge, Card, PageHeader, StatCard, humanStatus, statusTone } from '@/components/ui/kit';

export const dynamic = 'force-dynamic';

const ROLE_BLURB: Record<UserRole, string> = {
  FARMER: 'You produce and sell to arhtis. Your village and farm details help arhtis judge your consignments.',
  ARHTI: 'You buy from farmers and auction in the mandi. Your firm name and licence appear on every offer you make.',
  VENDOR: 'You win mandi lots and supply shopkeepers. Your warehouse city decides which shopkeepers can buy from you.',
  SHOPKEEPER: 'You buy wholesale and sell retail. Your shop name, hours and delivery radius are what customers see.',
  CONSUMER: 'You buy from nearby shops. Your address and city decide which shops can deliver to you.',
  ADMIN: 'You oversee the whole network. Admin accounts have no trading profile.',
};

export default async function ProfilePage() {
  const [user, trust] = await Promise.all([getMyProfile(), getMyTrust()]);

  const farmer = user.farmerProfile;
  const arhti = user.arhtiProfile;
  const vendor = user.vendorProfile;
  const shop = user.shopkeeperProfile;
  const consumer = user.consumerProfile;

  return (
    <div className="max-w-2xl mx-auto">
      <PageHeader
        title="Profile"
        titleUrdu="پروفائل"
        subtitle={ROLE_BLURB[user.role]}
      />

      <Card className="mb-4">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-bold text-charcoal">{user.name}</span>
              <Badge tone="green">{user.role}</Badge>
              <Badge tone={statusTone(user.status)}>{humanStatus(user.status)}</Badge>
            </div>
            <div className="text-[11px] text-[#636E72] mt-1">
              {user.email}
              {user.phone ? ` · ${user.phone}` : ''}
            </div>
            <div className="text-[10px] text-[#636E72]">
              Member since {new Date(user.createdAt).toLocaleDateString('en-PK', { month: 'long', year: 'numeric' })}
              {arhti?.mandi ? ` · trades at ${arhti.mandi.name}` : ''}
            </div>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 mb-4">
        <StatCard
          label="Rating"
          value={trust.average ? `${trust.average.toFixed(1)}★` : '—'}
          hint={trust.count ? `${trust.count} reviews` : 'No reviews yet'}
          tone="accent"
        />
        <StatCard label="Account role" value={user.role} hint="One role per account" />
        <StatCard label="Status" value={humanStatus(user.status)} hint="Set by the mandi admin" />
      </div>

      <Card className="mb-4">
        <h2 className="text-xs font-bold text-charcoal mb-3">Edit your details</h2>
        <ActionForm
          action={updateProfile}
          submitLabel="Save changes"
          submitLabelUrdu="محفوظ کریں"
          successMessage="Profile updated."
        >
          <div className="space-y-3">
            <Field label="Full name" labelUrdu="نام">
              <input name="name" required defaultValue={user.name} className={inputClass} />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Phone" labelUrdu="فون">
                <input name="phone" defaultValue={user.phone ?? ''} className={inputClass} />
              </Field>
              <Field label="Location" labelUrdu="مقام">
                <input name="location" defaultValue={user.location ?? ''} className={inputClass} />
              </Field>
            </div>

            {user.role === UserRole.FARMER && (
              <>
                <Field label="Farm or business name">
                  <input name="businessName" defaultValue={farmer?.businessName ?? ''} className={inputClass} />
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Village" labelUrdu="گاؤں">
                    <input name="village" defaultValue={farmer?.village ?? ''} className={inputClass} />
                  </Field>
                  <Field label="Farm area (acres)">
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
                <Field label="Firm name" labelUrdu="فرم">
                  <input name="businessName" defaultValue={arhti?.businessName ?? ''} className={inputClass} />
                </Field>
                <Field
                  label="Mandi licence number"
                  hint={`Commission rate ${((arhti?.commissionRate ?? 0.02) * 100).toFixed(1)}% — set by the admin`}
                >
                  <input name="licenseNumber" defaultValue={arhti?.licenseNumber ?? ''} className={inputClass} />
                </Field>
              </>
            )}

            {user.role === UserRole.VENDOR && (
              <>
                <Field label="Business name">
                  <input name="businessName" defaultValue={vendor?.businessName ?? ''} className={inputClass} />
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Warehouse city">
                    <input name="warehouseCity" defaultValue={vendor?.warehouseCity ?? ''} className={inputClass} />
                  </Field>
                  <Field label="Minimum order (kg)">
                    <input
                      name="minOrderKg"
                      type="number"
                      min="1"
                      defaultValue={vendor?.minOrderKg ?? 50}
                      className={inputClass}
                    />
                  </Field>
                </div>
                <Field label="Warehouse address">
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
                <Field label="Shop name" labelUrdu="دکان کا نام">
                  <input name="shopName" required defaultValue={shop?.shopName ?? ''} className={inputClass} />
                </Field>
                <Field label="Shop address">
                  <input name="shopAddress" defaultValue={shop?.shopAddress ?? ''} className={inputClass} />
                </Field>
                <div className="grid grid-cols-3 gap-3">
                  <Field label="City">
                    <input name="city" defaultValue={shop?.city ?? ''} className={inputClass} />
                  </Field>
                  <Field label="Opens">
                    <input name="opensAt" placeholder="07:00" defaultValue={shop?.opensAt ?? ''} className={inputClass} />
                  </Field>
                  <Field label="Closes">
                    <input name="closesAt" placeholder="21:00" defaultValue={shop?.closesAt ?? ''} className={inputClass} />
                  </Field>
                </div>
                <Field label="Delivery radius (km)" hint="Customers outside this radius will not see your shop as deliverable">
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
                <Field label="Delivery address" labelUrdu="پتہ">
                  <input
                    name="deliveryAddress"
                    defaultValue={consumer?.deliveryAddress ?? ''}
                    className={inputClass}
                  />
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="City">
                    <input name="preferredCity" defaultValue={consumer?.preferredCity ?? ''} className={inputClass} />
                  </Field>
                  <Field label="Household size">
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
          <h2 className="text-xs font-bold text-charcoal mb-3">What others say about you</h2>
          <div className="space-y-2">
            {trust.recent.map((rating) => (
              <div key={rating.id} className="rounded-xl border border-[#E5E7EB] p-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-semibold text-charcoal">
                    {'★'.repeat(rating.overallRating)}
                    <span className="text-[#E5E7EB]">{'★'.repeat(5 - rating.overallRating)}</span>
                  </span>
                  <Badge tone="neutral">{rating.rater.role}</Badge>
                  <span className="text-[10px] text-[#636E72]">
                    {new Date(rating.createdAt).toLocaleDateString('en-PK')}
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
