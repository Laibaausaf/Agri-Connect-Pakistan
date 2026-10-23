import { redirect } from 'next/navigation';
import { UserRole } from '@prisma/client';
import { requireAuth } from '@/lib/authz';
import FarmerHome from '@/components/dashboards/FarmerHome';
import ArhtiHome from '@/components/dashboards/ArhtiHome';
import VendorHome from '@/components/dashboards/VendorHome';
import ShopkeeperHome from '@/components/dashboards/ShopkeeperHome';

export const dynamic = 'force-dynamic';

/**
 * `/for-you` is the home screen for the four trading roles. Consumers and admins
 * have their own entry point and never see a trading dashboard.
 */
export default async function ForYouPage() {
  const user = await requireAuth();

  switch (user.role) {
    case UserRole.FARMER:
      return (
        <div className="max-w-6xl mx-auto">
          <FarmerHome userId={user.id} name={user.name} />
        </div>
      );
    case UserRole.ARHTI:
      return (
        <div className="max-w-5xl mx-auto">
          <ArhtiHome userId={user.id} name={user.name} />
        </div>
      );
    case UserRole.VENDOR:
      return (
        <div className="max-w-5xl mx-auto">
          <VendorHome userId={user.id} name={user.name} />
        </div>
      );
    case UserRole.SHOPKEEPER:
      return (
        <div className="max-w-5xl mx-auto">
          <ShopkeeperHome userId={user.id} name={user.name} />
        </div>
      );
    case UserRole.CONSUMER:
      redirect('/shop');
    case UserRole.ADMIN:
      redirect('/admin');
  }
}
