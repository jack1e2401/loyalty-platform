import { ArrowClockwise } from "@phosphor-icons/react";
import { Alert, Button, Empty, Skeleton } from "antd";
import { useResource } from "../../../api/useResource";
import { createStorefrontClient } from "../../../api/storefront-client";
import { CmsCard, CmsPageHeader } from "../cms";
import { MerchantStoreDetails } from "../MerchantStoreDetails";
import { useToken } from "../merchant-page-support";

const api = createStorefrontClient();

export function MerchantStore() {
  const token = useToken();
  const resource = useResource(() => api.getStoreProfile(token), [token]);

  return (
    <section className="grid min-w-0 gap-5">
      <CmsPageHeader
        title="Thông tin cửa hàng"
        description="Quản lý hồ sơ thương hiệu, thông tin liên hệ và giờ mở cửa hiển thị trên gian hàng."
        action={
          <Button icon={<ArrowClockwise size={15} />} loading={resource.loading} onClick={resource.reload}>
            Làm mới
          </Button>
        }
      />
      {resource.loading && !resource.data ? (
        <CmsCard>
          <Skeleton active paragraph={{ rows: 6 }} />
        </CmsCard>
      ) : resource.error && !resource.data ? (
        <Alert
          role="alert"
          type="error"
          showIcon
          title="Không tải được thông tin cửa hàng"
          description={resource.error}
          action={
            <Button size="small" onClick={resource.reload}>
              Thử lại
            </Button>
          }
        />
      ) : resource.data?.merchant ? (
        <MerchantStoreDetails data={resource.data} token={token} />
      ) : (
        <CmsCard>
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description="Chưa có cấu hình cửa hàng cho ứng dụng này."
          />
        </CmsCard>
      )}
    </section>
  );
}
