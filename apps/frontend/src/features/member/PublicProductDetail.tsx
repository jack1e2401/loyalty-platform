import { Link, useParams } from "react-router-dom";
import { createCommerceClient, translateApiError } from "../../api/commerce-http";
import { useResource } from "../../api/useResource";
import { Button, EmptyState, ErrorState, LoadingState } from "../../components/ui";
import { ProductDetailContent } from "./PublicProductDetailContent";
const commerce = createCommerceClient(import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3000");

export function PublicProductDetail() {
  const { slug = "", productId = "" } = useParams();
  const parsedId = Number(productId);
  const validParams = slug.trim().length > 0 && Number.isSafeInteger(parsedId) && parsedId >= 1;

  const resource = useResource(
    () =>
      validParams
        ? commerce.getPublicStoreProduct(slug, parsedId).then((res) => res.product)
        : Promise.reject(new Error("INVALID_INPUT")),
    [slug, parsedId, validParams],
  );

  if (!validParams) {
    return (
      <main className="mx-auto max-w-4xl px-4 py-12">
        <ErrorState message="Đường dẫn sản phẩm không hợp lệ." />
      </main>
    );
  }
  if (resource.loading) {
    return (
      <main className="mx-auto max-w-6xl px-4 py-12">
        <LoadingState cards={1} />
      </main>
    );
  }
  if (resource.error || !resource.data) {
    const translated = translateApiError(resource.error ?? "");
    if (resource.error === "PRODUCT_NOT_FOUND" || resource.error === "MERCHANT_NOT_FOUND") {
      return (
        <main className="mx-auto max-w-4xl px-4 py-12">
          <EmptyState
            title="Không tìm thấy sản phẩm"
            description={translated}
            action={
              <Button asChild variant="outline">
                <Link to={`/s/${slug}`}>Về cửa hàng</Link>
              </Button>
            }
          />
        </main>
      );
    }
    return (
      <main className="mx-auto max-w-4xl px-4 py-12">
        <ErrorState message={translated || "Không tải được sản phẩm."} retry={resource.reload} />
      </main>
    );
  }

  return <ProductDetailContent slug={slug} product={resource.data} />;
}
