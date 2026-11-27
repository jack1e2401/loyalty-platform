import { useResource } from "../../../api/useResource";
import { EmptyState, ErrorState, LoadingState } from "../../../components/ui";
import { MerchantStoreDetails } from "../MerchantStoreDetails";
import { createStorefrontClient } from "../../../api/storefront-client";
import { useToken } from "../merchant-page-support";

const api = createStorefrontClient();

export function MerchantStore() {
  const token = useToken();
  const resource = useResource(() => api.getStoreProfile(token), [token]);
  return (
    <>
      {resource.loading ? (
        <LoadingState cards={1} />
      ) : resource.error ? (
        <ErrorState message={resource.error} retry={resource.reload} />
      ) : resource.data?.merchant ? (
        <MerchantStoreDetails data={resource.data} token={token} />
      ) : (
        <EmptyState
          title="Chưa có cửa hàng"
          description="Chưa có cấu hình cửa hàng cho ứng dụng này."
        />
      )}
    </>
  );
}
