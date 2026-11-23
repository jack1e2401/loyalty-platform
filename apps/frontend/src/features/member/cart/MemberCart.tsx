import { Link } from "react-router-dom";
import { ArrowRight } from "@phosphor-icons/react";
import { Button, Card, EmptyState, Field, Input, PageHeader } from "../../../components/ui";
import { money, useMerchantContext } from "../member-context";
export function MemberCart() {
  const { basePath, cart } = useMerchantContext();
  const stockIssue = cart.lines.find(
    ({ product, quantity }) => quantity > (product.inventory?.availableQuantity ?? quantity),
  );
  return (
    <>
      <PageHeader title="Giỏ hàng" />
      {!cart.lines.length ? (
        <EmptyState
          title="Giỏ hàng trống"
          description="Chọn sản phẩm từ gian hàng để tạo đơn."
          action={
            <Button asChild>
              <Link to={basePath}>Xem sản phẩm</Link>
            </Button>
          }
        />
      ) : (
        <div className="grid gap-5 lg:grid-cols-[1fr_20rem]">
          <div className="space-y-3">
            {cart.lines.map(({ product, quantity }) => (
              <Card key={product.id} className="p-4 sm:p-5">
                <h2 className="font-extrabold break-words">{product.name}</h2>
                <p className="mt-1 text-sm muted tabular-nums break-words">
                  {money(product.price)} mỗi sản phẩm
                </p>
                <div className="mt-3">
                  <Field label="Số lượng">
                    <Input
                      type="number"
                      min={1}
                      max={Math.min(99, product.inventory?.availableQuantity ?? 99)}
                      aria-label={`Số lượng ${product.name}`}
                      value={quantity}
                      onChange={(event) => {
                        const val = event.target.valueAsNumber;
                        if (!Number.isNaN(val)) cart.setQuantity(product.id, val);
                      }}
                    />
                  </Field>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  className="mt-3 text-[#a4473a] hover:text-[#8d382d]"
                  aria-label={`Bỏ ${product.name} khỏi giỏ hàng`}
                  onClick={() => cart.removeProduct(product.id)}
                >
                  Bỏ sản phẩm
                </Button>
              </Card>
            ))}
          </div>
          <Card className="h-fit p-4 sm:p-5">
            <p className="text-xs muted">Tạm tính</p>
            <p className="mt-2 text-2xl font-extrabold tabular-nums break-words">{money(cart.subtotal)}</p>
            {stockIssue && (
              <p role="alert" className="mt-3 text-sm text-[#a4473a]">
                Số lượng {stockIssue.product.name} vượt tồn kho hiện tại.
              </p>
            )}
            <Button asChild className="mt-5 w-full" disabled={Boolean(stockIssue)}>
              <Link to={`${basePath}/checkout`} aria-disabled={Boolean(stockIssue)}>
                Tiếp tục <ArrowRight aria-hidden="true" size={16} />
              </Link>
            </Button>
          </Card>
        </div>
      )}
    </>
  );
}
