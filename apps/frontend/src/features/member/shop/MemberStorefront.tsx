import { useEffect, useState } from "react";
import { Link, useOutletContext } from "react-router-dom";
import { ArrowRight, ShoppingCart } from "@phosphor-icons/react";
import { useApi } from "../../../api/client";
import { useResource } from "../../../api/useResource";
import { EmptyState, ErrorState, LoadingState, Button } from "../../../components/ui";
import type { MemberOutlet } from "../../../layouts/MemberLayout";
import { MemberMascot } from "../MemberMascot";
import { ProductCard } from "./ProductCard";

export function MemberStorefront() {
  const { merchant, addToCart, cart } = useOutletContext<MemberOutlet>();
  const api = useApi();
  const products = useResource(() => api.listProducts(merchant.id), [merchant.id]);
  const wallet = useResource(() => api.getWallet(merchant.id), [merchant.id]);
  const [category, setCategory] = useState("Tất cả");
  useEffect(() => {
    setCategory("Tất cả");
  }, [merchant.id]);
  const active = products.data?.filter((p) => p.active) ?? [];
  const categories = ["Tất cả", ...new Set(active.map((p) => p.category))];
  const visible = category === "Tất cả" ? active : active.filter((p) => p.category === category);
  return (
    <>
      <section className="member-gradient relative overflow-hidden rounded-[2rem] px-6 py-9 sm:px-10 sm:py-12 lg:min-h-[330px]">
        <div className="relative z-1 max-w-[630px]">
          <p className="text-xs font-semibold tracking-wide text-[#527b56]">{merchant.category}</p>
          <h1 className="serif mt-5 max-w-[580px] text-[2.6rem] leading-[1.05] tracking-[-.045em] text-[#2b4f36] sm:text-[3.4rem]">
            {merchant.tagline}
          </h1>
          <p className="mt-5 max-w-md text-sm leading-7 text-[#657b69]">{merchant.description}</p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Button asChild>
              <a href="#products">
                Khám phá sản phẩm <ArrowRight size={17} />
              </a>
            </Button>
            <Button asChild variant="outline" className="bg-white/60">
              <Link to={`/member/${merchant.id}/wallet`}>
                {wallet.loading ? "Đang tải điểm..." : `${wallet.data?.availablePoints ?? 0} điểm của bạn`}
              </Link>
            </Button>
          </div>
        </div>
        <div className="pointer-events-none absolute -bottom-10 right-[-2rem] hidden h-[300px] w-[350px] lg:block">
          <MemberMascot mood="hello" />
        </div>
        <div className="pointer-events-none absolute -right-20 -top-20 h-70 w-70 rounded-full bg-white/25 blur-3xl" />
      </section>
      <section id="products" className="scroll-mt-28 pt-11">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-[10px] font-extrabold uppercase tracking-[.2em] text-[#8ab182]">
              Danh mục chọn lọc
            </p>
            <h2 className="serif mt-2 text-3xl text-[#294432] sm:text-4xl">Sản phẩm dành cho bạn</h2>
          </div>
          <Link to="cart" className="flex items-center gap-2 text-xs font-bold accent">
            <ShoppingCart size={17} /> Giỏ hàng ({cart.reduce((n, i) => n + i.quantity, 0)}){" "}
            <ArrowRight size={15} />
          </Link>
        </div>
        <div className="mb-6 flex gap-2 overflow-x-auto pb-2">
          {categories.map((c) => (
            <button
              key={c}
              onClick={() => setCategory(c)}
              className={`shrink-0 rounded-full px-4 py-2 text-xs font-bold transition ${category === c ? "bg-[#335e3d] text-white" : "bg-[#edf3e9] text-[#66806a] hover:bg-[#dfeedd]"}`}
            >
              {c}
            </button>
          ))}
        </div>
        {products.loading ? (
          <LoadingState />
        ) : products.error ? (
          <ErrorState message={products.error} retry={products.reload} />
        ) : !visible.length ? (
          <EmptyState title="Chưa có sản phẩm" description="Hãy thử danh mục khác hoặc quay lại sau." />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {visible.map((p) => (
              <ProductCard key={p.id} product={p} add={() => addToCart(p.id)} />
            ))}
          </div>
        )}
      </section>
    </>
  );
}
