import type { Dispatch, SetStateAction } from "react";
import type { LoyaltyConfigInput } from "../../../api/commerce-types";
import { Button, Field, Input } from "../../../components/ui";

type Props = {
  configSection: "program" | "tiers" | "reset";
  form: LoyaltyConfigInput;
  setDraft: Dispatch<SetStateAction<LoyaltyConfigInput | null>>;
  expandedTiers: Record<string, boolean>;
  setExpandedTiers: Dispatch<SetStateAction<Record<string, boolean>>>;
  showOptional: Record<string, boolean>;
  setShowOptional: Dispatch<SetStateAction<Record<string, boolean>>>;
};

export function LoyaltyTiersEditor({
  configSection,
  form,
  setDraft,
  expandedTiers,
  setExpandedTiers,
  showOptional,
  setShowOptional,
}: Props) {
  return (
    <>
      {configSection === "tiers" && (
        <>
          <section aria-label="Cấu hình hạng" className="space-y-2">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 className="font-extrabold">Các hạng</h2>
                <p className="mt-1 text-xs muted">Hạng mặc định không thể xóa. Ngưỡng phải tăng dần.</p>
              </div>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  const last = form.tiers.at(-1);
                  const level = `tier-${Date.now()}`;
                  const order = form.tiers.length;
                  const nextTier = {
                    level,
                    name: `Hạng ${order + 1}`,
                    ...(form.qualificationMode === "POINTS"
                      ? { minLifetimePoints: Number(last?.minLifetimePoints ?? 0) + 1 }
                      : { minSpendVnd: String(Number(last?.minSpendVnd ?? 0) + 1) }),
                    multiplier: "1.00",
                    benefits: [],
                    iconUrl: null,
                    color: "#6B7280",
                    maintenanceSpendVnd: null,
                    sortOrder: order,
                    isActive: true,
                  };
                  setDraft({ ...form, tiers: [...form.tiers, nextTier] });
                }}
              >
                Thêm hạng
              </Button>
            </div>
            {form.tiers.map((tier, index) => (
              <div
                key={tier.level}
                className="grid items-end gap-2 rounded-lg border border-[#e5ece3] bg-[#f7f9f5] p-3 sm:grid-cols-2"
              >
                <div className="flex items-center justify-between sm:col-span-2">
                  <button
                    type="button"
                    aria-expanded={expandedTiers[tier.level] ?? false}
                    onClick={() => setExpandedTiers((old) => ({ ...old, [tier.level]: !old[tier.level] }))}
                    className="flex items-center gap-2 text-sm font-semibold text-[#294833]"
                  >
                    <span aria-hidden="true">{expandedTiers[tier.level] ? "▾" : "▸"}</span>
                    {tier.name || `Hạng ${index + 1}`}
                  </button>
                  {index > 0 && (
                    <button
                      type="button"
                      className="rounded-md px-2 py-1 text-xs font-medium text-[#a4473a] hover:bg-[#f9e9e6]"
                      onClick={() =>
                        setDraft({
                          ...form,
                          tiers: form.tiers
                            .filter((_, i) => i !== index)
                            .map((item, i) => ({ ...item, sortOrder: i })),
                        })
                      }
                    >
                      Xóa hạng
                    </button>
                  )}
                </div>
                {expandedTiers[tier.level] && (
                  <>
                    <Field label="Tên hạng">
                      <Input
                        required
                        maxLength={80}
                        value={tier.name ?? tier.level}
                        onChange={(event) =>
                          setDraft({
                            ...form,
                            tiers: form.tiers.map((item, i) =>
                              i === index ? { ...item, name: event.target.value } : item,
                            ),
                          })
                        }
                      />
                    </Field>
                    <Field
                      label={
                        form.qualificationMode === "POINTS" ? "Điểm tối thiểu" : "Chi tiêu tối thiểu (VND)"
                      }
                    >
                      <Input
                        required
                        type="number"
                        min={index === 0 ? 0 : 1}
                        step={1}
                        disabled={index === 0}
                        value={
                          form.qualificationMode === "POINTS"
                            ? (tier.minLifetimePoints ?? (index === 0 ? 0 : ""))
                            : (tier.minSpendVnd ?? (index === 0 ? "0" : ""))
                        }
                        onChange={(event) =>
                          setDraft({
                            ...form,
                            tiers: form.tiers.map((item, i) =>
                              i === index
                                ? form.qualificationMode === "POINTS"
                                  ? {
                                      ...item,
                                      minLifetimePoints:
                                        event.target.value === "" ? undefined : Number(event.target.value),
                                      minSpendVnd: undefined,
                                    }
                                  : { ...item, minSpendVnd: event.target.value, minLifetimePoints: undefined }
                                : item,
                            ),
                          })
                        }
                      />
                    </Field>
                    <Field label="Hệ số">
                      <Input
                        required
                        pattern="[0-9]{1,3}\.[0-9]{2}"
                        value={tier.multiplier}
                        onChange={(event) =>
                          setDraft({
                            ...form,
                            tiers: form.tiers.map((item, i) =>
                              i === index ? { ...item, multiplier: event.target.value } : item,
                            ),
                          })
                        }
                      />
                    </Field>
                    <Field label="Màu hạng">
                      <div className="flex items-center gap-2">
                        <Input
                          aria-label={`Mã HEX màu ${tier.name || `hạng ${index + 1}`}`}
                          value={tier.color ?? "#6B7280"}
                          pattern="^#[0-9A-Fa-f]{6}$"
                          maxLength={7}
                          onChange={(event) =>
                            setDraft({
                              ...form,
                              tiers: form.tiers.map((item, i) =>
                                i === index ? { ...item, color: event.target.value } : item,
                              ),
                            })
                          }
                        />
                        <label
                          className="relative size-9 shrink-0 cursor-pointer overflow-hidden rounded-md border border-[#d5ded3] shadow-sm"
                          style={{
                            backgroundColor: /^#[0-9A-Fa-f]{6}$/.test(tier.color ?? "")
                              ? tier.color!
                              : "#ffffff",
                          }}
                          title="Chọn màu"
                        >
                          <span className="sr-only">Mở bảng chọn màu</span>
                          <input
                            aria-label={`Chọn màu cho ${tier.name || `hạng ${index + 1}`}`}
                            type="color"
                            value={/^#[0-9A-Fa-f]{6}$/.test(tier.color ?? "") ? tier.color! : "#6B7280"}
                            onChange={(event) =>
                              setDraft({
                                ...form,
                                tiers: form.tiers.map((item, i) =>
                                  i === index ? { ...item, color: event.target.value.toUpperCase() } : item,
                                ),
                              })
                            }
                            className="absolute inset-0 size-full cursor-pointer opacity-0"
                          />
                        </label>
                      </div>
                    </Field>
                    <div className="sm:col-span-2 flex flex-wrap items-center gap-2 border-t border-[#e5ece3] pt-2">
                      <button
                        type="button"
                        className="text-xs font-medium text-[#416b48]"
                        onClick={() => setShowOptional((old) => ({ ...old, [tier.level]: !old[tier.level] }))}
                      >
                        {showOptional[tier.level] ? "Ẩn tùy chọn" : "Tùy chọn"}
                      </button>
                      {!showOptional[tier.level] && (
                        <span className="text-xs text-[#89958b]">Quyền lợi: chưa triển khai</span>
                      )}
                    </div>
                    {showOptional[tier.level] && (
                      <>
                        <Field label="Lợi ích">
                          <Input disabled placeholder="Chưa triển khai" value="" />
                        </Field>
                        <Field label="Chi tiêu duy trì hạng (VND)">
                          <Input
                            type="number"
                            min={0}
                            value={tier.maintenanceSpendVnd ?? ""}
                            onChange={(event) =>
                              setDraft({
                                ...form,
                                tiers: form.tiers.map((item, i) =>
                                  i === index
                                    ? { ...item, maintenanceSpendVnd: event.target.value || null }
                                    : item,
                                ),
                              })
                            }
                          />
                        </Field>
                      </>
                    )}
                  </>
                )}
              </div>
            ))}
          </section>
        </>
      )}
    </>
  );
}
