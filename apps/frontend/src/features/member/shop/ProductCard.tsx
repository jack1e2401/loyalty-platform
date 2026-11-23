import { Link } from "react-router-dom";
import { ImageSquare, Plus } from "@phosphor-icons/react";
import type { Product } from "../../../api/types";
import { Button, Card } from "../../../components/ui";
import { money } from "../../../lib/utils";

export function ProductCard({ product, add }: { product: Product; add: () => void }) {
  return (
    <Card className="card-hover group overflow-hidden">
      <Link to={`product/${product.id}`} className="block aspect-[1.16] overflow-hidden bg-[#edf2e9]">
        {product.image ? (
          <img
            src={product.image}
            alt={product.name}
            className="h-full w-full object-cover transition-transform duration-700 ease-[cubic-bezier(.32,.72,0,1)] group-hover:scale-105"
          />
        ) : (
          <div className="grid h-full place-items-center text-[#9dad99]">
            <ImageSquare size={34} weight="light" aria-hidden="true" />
          </div>
        )}
      </Link>
      <div className="p-5">
        <p className="text-[11px] font-semibold text-[#6b826b]">{product.category}</p>
        <Link
          to={`product/${product.id}`}
          className="mt-2 block text-base font-extrabold text-[#294432] hover:text-[#5b8059]"
        >
          {product.name}
        </Link>
        <p className="mt-1 line-clamp-2 min-h-10 text-xs leading-5 muted">{product.description}</p>
        <div className="mt-4 flex items-center justify-between gap-2">
          <span className="text-base font-extrabold text-[#315f3d]">{money(product.price)}</span>
          <Button size="icon" aria-label={`Thêm ${product.name} vào giỏ`} onClick={add}>
            <Plus size={18} />
          </Button>
        </div>
      </div>
    </Card>
  );
}
