import { useState, type FormEvent } from "react";
import { memberProfileApi, type MemberProfileDto } from "../../api/member-profile";
import { useResource } from "../../api/useResource";
import { Button, Card, ErrorState, Field, Input, LoadingState } from "../../components/ui";

export function MemberProfileForm({ token }: { token: string }) {
  const resource = useResource(() => memberProfileApi.get(token), [token]);
  const [draft, setDraft] = useState<Pick<MemberProfileDto, "name" | "phone" | "address" | "birthDate"> | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const profile = resource.data?.profile;
  const form = draft ?? (profile ? { name: profile.name, phone: profile.phone, address: profile.address, birthDate: profile.birthDate } : null);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!form || busy) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await memberProfileApi.update(token, form);
      setDraft(null);
      resource.reload();
      setNotice("Đã cập nhật hồ sơ.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Không thể cập nhật hồ sơ.");
    } finally {
      setBusy(false);
    }
  }

  if (resource.loading) return <LoadingState cards={1} />;
  if (resource.error || !profile || !form) return <ErrorState message={resource.error ?? "Hồ sơ chưa khả dụng."} retry={resource.reload} />;
  return <Card className="p-5"><h2 className="text-lg font-extrabold text-[#20392a]">Thông tin cá nhân</h2><p className="mt-1 text-sm muted">Thông tin chỉ dùng trong cửa hàng này.</p>
    <form className="mt-4 grid gap-4 sm:grid-cols-2" onSubmit={save}>
      <Field label="Họ và tên"><Input maxLength={191} value={form.name ?? ""} onChange={(event) => setDraft({ ...form, name: event.target.value || null })} /></Field>
      <Field label="Số điện thoại"><Input maxLength={40} value={form.phone ?? ""} onChange={(event) => setDraft({ ...form, phone: event.target.value || null })} /></Field>
      <Field label="Ngày sinh"><Input type="date" value={form.birthDate ?? ""} onChange={(event) => setDraft({ ...form, birthDate: event.target.value || null })} /></Field>
      <Field label="Địa chỉ"><Input maxLength={500} value={form.address ?? ""} onChange={(event) => setDraft({ ...form, address: event.target.value || null })} /></Field>
      {error && <p role="alert" className="text-sm text-[#a4473a] sm:col-span-2">{error}</p>}
      {notice && <p role="status" className="text-sm text-[#357044] sm:col-span-2">{notice}</p>}
      <div className="sm:col-span-2"><Button disabled={busy}>{busy ? "Đang lưu" : "Lưu hồ sơ"}</Button></div>
    </form>
  </Card>;
}
