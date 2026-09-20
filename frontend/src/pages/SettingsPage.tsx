import { useEffect, useState, type FormEvent } from "react";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Card } from "@/components/ui/Card";
import { Field } from "@/components/ui/Field";
import { Skeleton } from "@/components/ui/Skeleton";
import { useSettings, useUpdateSettings } from "@/hooks/useSettings";
import { AppUpdateCard } from "@/components/settings/AppUpdateCard";
import type { HotelSettings } from "@/types";

type Form = Omit<HotelSettings, "cgst_percent" | "sgst_percent"> & {
  cgst_percent: string;
  sgst_percent: string;
};

export default function SettingsPage() {
  const { data, isLoading } = useSettings();
  const update = useUpdateSettings();
  const [form, setForm] = useState<Form | null>(null);
  const [errors, setErrors] = useState<Partial<Record<keyof Form, string>>>({});

  useEffect(() => {
    if (data) {
      setForm({ ...data, cgst_percent: String(data.cgst_percent), sgst_percent: String(data.sgst_percent) });
    }
  }, [data]);

  const set = (key: keyof Form, value: string) =>
    setForm((prev) => (prev ? { ...prev, [key]: value } : prev));

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!form) return;
    const next: Partial<Record<keyof Form, string>> = {};
    if (!form.hotel_name.trim()) next.hotel_name = "Hotel name is required";
    if (!form.address.trim()) next.address = "Address is required";
    if (!form.mobile_numbers.trim()) next.mobile_numbers = "Enter at least one mobile number";
    for (const k of ["cgst_percent", "sgst_percent"] as const) {
      const n = Number(form[k]);
      if (form[k].trim() === "" || Number.isNaN(n) || n < 0 || n > 50) next[k] = "Enter 0–50";
    }
    setErrors(next);
    if (Object.keys(next).length) return;
    update.mutate({
      ...form,
      hotel_name: form.hotel_name.trim(),
      address: form.address.trim(),
      mobile_numbers: form.mobile_numbers.trim(),
      gst_number: form.gst_number.trim().toUpperCase(),
      cgst_percent: Number(form.cgst_percent),
      sgst_percent: Number(form.sgst_percent),
    });
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Hotel Settings"
        subtitle="These details and tax rates appear on every invoice."
      />
      <Card className="p-6">
        {isLoading || !form ? (
          <Skeleton className="h-64 w-full" />
        ) : (
          <form onSubmit={submit} className="space-y-6" noValidate>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Hotel name" htmlFor="hotel_name" required error={errors.hotel_name}>
                <Input id="hotel_name" value={form.hotel_name} onChange={(e) => set("hotel_name", e.target.value)} />
              </Field>
              <Field label="Tagline" htmlFor="tagline">
                <Input id="tagline" value={form.tagline} onChange={(e) => set("tagline", e.target.value)} />
              </Field>
              <div className="sm:col-span-2">
                <Field label="Address" htmlFor="address" required error={errors.address}>
                  <Input id="address" value={form.address} onChange={(e) => set("address", e.target.value)} />
                </Field>
              </div>
              <Field
                label="Mobile numbers"
                htmlFor="mobile_numbers"
                required
                error={errors.mobile_numbers}
                hint="Separate several numbers with ||"
              >
                <Input id="mobile_numbers" value={form.mobile_numbers} onChange={(e) => set("mobile_numbers", e.target.value)} />
              </Field>
              <Field label="Jurisdiction" htmlFor="jurisdiction">
                <Input id="jurisdiction" value={form.jurisdiction} onChange={(e) => set("jurisdiction", e.target.value)} />
              </Field>
              <Field label="GST number" htmlFor="gst_number">
                <Input id="gst_number" value={form.gst_number} onChange={(e) => set("gst_number", e.target.value)} />
              </Field>
              <Field label="HSN / SAC code" htmlFor="hsn_code">
                <Input id="hsn_code" value={form.hsn_code} onChange={(e) => set("hsn_code", e.target.value)} />
              </Field>
              <Field label="CGST %" htmlFor="cgst_percent" required error={errors.cgst_percent}>
                <Input id="cgst_percent" type="number" step="0.01" min={0} value={form.cgst_percent} onChange={(e) => set("cgst_percent", e.target.value)} />
              </Field>
              <Field label="SGST %" htmlFor="sgst_percent" required error={errors.sgst_percent}>
                <Input id="sgst_percent" type="number" step="0.01" min={0} value={form.sgst_percent} onChange={(e) => set("sgst_percent", e.target.value)} />
              </Field>
            </div>
            <p className="text-xs text-muted-foreground">
              Tax rates are saved on each booking when it is created, so changing them here only
              affects new bookings.
            </p>
            <div className="flex justify-end">
              <Button type="submit" isLoading={update.isPending}>
                Save settings
              </Button>
            </div>
          </form>
        )}
      </Card>
      <AppUpdateCard />
    </div>
  );
}
