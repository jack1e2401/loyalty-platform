import { useState } from "react";
import type { VoucherDefinitionDto } from "../../../api/commerce-types";
import { useResource } from "../../../api/useResource";
import {
  EmptyState,
  ErrorState,
  LoadingState,
  PageHeader,
} from "../../../components/ui";
import { api, message, useToken } from "../merchant-page-support";
import { MerchantPagination } from "../cms/MerchantPagination";
import { VoucherCreateDialog } from "./VoucherCreateDialog";
import { VoucherListFilters } from "../VoucherListFilters";
import { MerchantVouchersTable } from "../MerchantVouchersTable";

export function MerchantVouchers() {
  const token = useToken();
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [type, setType] = useState<"" | "DISCOUNT" | "REWARD">("");
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<"" | "active" | "inactive">("");
  const [sort, setSort] = useState<"newest" | "name" | "points">("newest");
  const [busyId, setBusyId] = useState<number | null>(null);
  const [notice, setNotice] = useState("");
  const resource = useResource(
    () => api.listMerchantVoucherDefinitions(token, { page, limit, q: q.trim() || undefined, type: type || undefined, status: status || undefined, sort }),
    [token, page, limit, q, type, status, sort],
  );

  async function toggle(definition: VoucherDefinitionDto): Promise<void> {
    if (busyId !== null) throw new Error("Đang cập nhật trạng thái voucher khác.");
    setBusyId(definition.id);
    setNotice("");
    try {
      const response = await api.updateVoucherDefinition(
        definition.id,
        { isActive: !definition.isActive },
        token,
      );
      updateDefinition(response.definition);
      setNotice("Đã cập nhật voucher.");
    } catch (reason) {
      throw new Error(message(reason));
    } finally {
      setBusyId(null);
    }
  }

  function updateDefinition(definition: VoucherDefinitionDto) {
    resource.setData(
      (current) => current ? { ...current, definitions: current.definitions.map((item) => item.id === definition.id ? definition : item) } : null,
    );
    resource.reload();
  }

  return (
    <>
      <PageHeader title="Voucher" action={<VoucherCreateDialog token={token} onCreated={() => {
        setPage(1); resource.reload(); setNotice("Đã tạo voucher.");
      }} />} />
      {notice && <p role="status" className="mb-4 text-sm text-[#357044]">{notice}</p>}
      <VoucherListFilters
        counts={resource.data?.counts}
        type={type} q={q} status={status} sort={sort}
        onType={(value) => { setType(value); setPage(1); }}
        onQuery={(value) => { setQ(value); setPage(1); }}
        onStatus={(value) => { setStatus(value); setPage(1); }}
        onSort={(value) => { setSort(value); setPage(1); }}
      />
      {resource.loading ? (
        <LoadingState cards={2} />
      ) : resource.error ? (
        <ErrorState message={resource.error} retry={resource.reload} />
      ) : !resource.data?.definitions.length ? (
        <EmptyState
          title="Không có voucher phù hợp"
          description="Thử thay đổi bộ lọc hoặc tạo voucher mới."
        />
      ) : (
        <>
        <MerchantVouchersTable
          definitions={resource.data.definitions}
          token={token}
          busyId={busyId}
          onToggle={toggle}
          onDefinitionChange={updateDefinition}
        />
        </>
      )}
      {resource.data?.pagination && <MerchantPagination page={resource.data.pagination.page} limit={resource.data.pagination.limit}
        totalItems={resource.data.pagination.totalItems} onChange={(nextPage, nextLimit) => { setPage(nextPage); setLimit(nextLimit); }} />}
    </>
  );
}
