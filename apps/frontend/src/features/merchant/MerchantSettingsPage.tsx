import { CmsPageHeader } from "./cms";
import { MerchantSettingsGrid } from "./MerchantSettingsGrid";

export function MerchantSettingsPage() {
  return (
    <div className="space-y-6">
      <CmsPageHeader
        title="Cấu hình hệ thống"
        description="Quản trị toàn diện hoạt động kinh doanh, địa điểm và chương trình khách hàng thân thiết."
      />
      <MerchantSettingsGrid />
    </div>
  );
}
