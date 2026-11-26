import { Link } from "react-router-dom";
import {
  CalendarCheck,
  Crown,
  Gear,
  ListDashes,
  MapPin,
  Receipt,
  Storefront,
  Ticket,
  Trophy,
} from "@phosphor-icons/react";

interface SettingItem {
  id: string;
  icon: typeof Gear;
  title: string;
  description: string;
  to?: string;
  onClick?: () => void;
  highlighted?: boolean;
}

export function MerchantSettingsGrid({
  onSelectSection,
}: {
  onSelectSection?: (id: string) => void;
}) {
  const items: SettingItem[] = [
    {
      id: "general",
      icon: Gear,
      title: "Cấu hình chung",
      description: "Cấu hình thông tin chung cửa hàng của bạn",
      onClick: () => onSelectSection?.("general"),
    },
    {
      id: "location",
      icon: MapPin,
      title: "Địa điểm",
      description: "Quản lý danh sách địa chỉ và khung giờ mở cửa",
      onClick: () => onSelectSection?.("location"),
      highlighted: true,
    },
    {
      id: "storefront",
      icon: Storefront,
      title: "Giao diện gian hàng",
      description: "Quản lý banner, thứ tự hiển thị và sản phẩm nổi bật",
      to: "/merchant/storefront",
    },
    {
      id: "categories",
      icon: ListDashes,
      title: "Cấu hình danh mục",
      description: "Quản lý phân loại danh mục sản phẩm",
      to: "/merchant/categories",
    },
    {
      id: "loyalty",
      icon: Crown,
      title: "Chương trình Loyalty",
      description: "Cấu hình tỷ lệ quy đổi điểm và các hạng thành viên",
      to: "/merchant/loyalty/config",
    },
    {
      id: "vouchers",
      icon: Ticket,
      title: "Voucher & Khuyến mãi",
      description: "Quản lý mã giảm giá và quà tặng đổi điểm",
      to: "/merchant/vouchers",
    },
    {
      id: "orders",
      icon: Receipt,
      title: "Đơn hàng & Giao dịch",
      description: "Theo dõi đơn mua hàng và hàng đợi đổi thưởng",
      to: "/merchant/orders",
    },
    {
      id: "challenges",
      icon: Trophy,
      title: "Nhiệm vụ & Gamification",
      description: "Cung cấp nhiệm vụ tích điểm và cột mốc nhận thưởng",
      to: "/merchant/challenges",
    },
    {
      id: "events",
      icon: CalendarCheck,
      title: "Sự kiện",
      description: "Quản lý lịch sự kiện và workshop trải nghiệm",
      to: "/merchant/events",
    },
  ];

  return (
    <section aria-labelledby="settings-hub-heading" className="mb-8 rounded-2xl border border-[#e3e9e2] bg-white p-6 shadow-[0_1px_3px_rgba(0,0,0,0.03)] sm:p-7">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 pb-4">
        <div>
          <h2 id="settings-hub-heading" className="text-base font-bold text-[#11231a]">
            Cấu hình hệ thống
          </h2>
          <p className="mt-0.5 text-xs text-gray-500">
            Quản trị toàn diện hoạt động kinh doanh, địa điểm và chương trình khách hàng thân thiết
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-x-8 gap-y-6 md:grid-cols-2 lg:grid-cols-3">
        {items.map((item) => {
          const Icon = item.icon;
          const content = (
            <div
              className={`flex items-start gap-4 rounded-xl p-3 transition ${
                item.highlighted
                  ? "border border-red-500/80 bg-red-50/20 shadow-xs"
                  : "border border-transparent hover:border-gray-200/60 hover:bg-gray-50/80"
              }`}
            >
              <span className="grid size-10 shrink-0 place-items-center rounded-lg border border-gray-200/70 bg-gray-50 text-gray-700 shadow-2xs">
                <Icon size={20} weight="regular" />
              </span>
              <div className="min-w-0 flex-1">
                <span className="block text-[14px] font-semibold text-[#11231a] leading-tight">
                  {item.title}
                </span>
                <span className="mt-1 block text-[12px] leading-relaxed text-gray-500 line-clamp-2">
                  {item.description}
                </span>
              </div>
            </div>
          );

          if (item.to) {
            return (
              <Link key={item.id} to={item.to} className="block group">
                {content}
              </Link>
            );
          }

          return (
            <button
              key={item.id}
              type="button"
              onClick={item.onClick}
              className="block w-full text-left group"
            >
              {content}
            </button>
          );
        })}
      </div>
    </section>
  );
}
