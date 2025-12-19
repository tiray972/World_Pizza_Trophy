import React, { useState } from "react";
import { Button } from "./ui/Button";
import { Voucher } from "../types";
import { X } from "lucide-react";
import { Timestamp } from "firebase/firestore";

interface VoucherFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (voucherData: Omit<Voucher, "id" | "isUsed" | "userId" | "createdAt" | "eventId">) => Promise<void>;
}

// Mock products
const PRODUCT_OPTIONS = [
  { id: "p1", name: "Single Competitor Entry" },
  { id: "p2", name: "Team Pack (3 Entries)" },
  { id: "p3", name: "Early Bird Special" }
];

export function VoucherFormModal({
  isOpen,
  onClose,
  onConfirm,
}: VoucherFormModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    code: "",
    productId: PRODUCT_OPTIONS[0].id,
    isSingleUse: "true",
    expiresAt: "",
  });

  if (!isOpen) return null;

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    try {
      await onConfirm({
        code: formData.code.toUpperCase(),
        productId: formData.productId,
        isSingleUse: formData.isSingleUse === "true",
        expiresAt: formData.expiresAt ? Timestamp.fromDate(new Date(formData.expiresAt)) : null,
      });
      
      setFormData({
        code: "",
        productId: PRODUCT_OPTIONS[0].id,
        isSingleUse: "true",
        expiresAt: "",
      });
      onClose();
    } catch (error) {
      console.error("Failed to create voucher", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div 
        className="fixed inset-0 bg-background/80 backdrop-blur-sm transition-opacity" 
        onClick={onClose}
      />
      <div className="fixed z-50 grid w-full max-w-lg scale-100 gap-4 border bg-card text-card-foreground p-6 shadow-lg duration-200 sm:rounded-lg md:w-full">
        <div className="flex flex-col space-y-1.5 text-center sm:text-left">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold leading-none tracking-tight">
              Create New Voucher
            </h2>
            <Button variant="ghost" size="icon" className="h-6 w-6 text-foreground" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
          <p className="text-sm text-muted-foreground">
            Generate a promo code for competitors.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="grid gap-4 py-4">
          <div className="grid gap-2">
            <label htmlFor="code" className="text-sm font-medium">Voucher Code</label>
            <input
              id="code"
              name="code"
              type="text"
              required
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm uppercase"
              placeholder="e.g. PIZZA2025"
              value={formData.code}
              onChange={handleChange}
            />
          </div>

          <div className="grid gap-2">
            <label htmlFor="productId" className="text-sm font-medium">Applicable Product</label>
            <select
              id="productId"
              name="productId"
              required
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={formData.productId}
              onChange={handleChange}
            >
              {PRODUCT_OPTIONS.map((prod) => (
                <option key={prod.id} value={prod.id}>
                  {prod.name}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <label htmlFor="isSingleUse" className="text-sm font-medium">Usage Type</label>
              <select
                id="isSingleUse"
                name="isSingleUse"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={formData.isSingleUse}
                onChange={handleChange}
              >
                <option value="true">Single Use</option>
                <option value="false">Multi-use (Unlimited)</option>
              </select>
            </div>
            <div className="grid gap-2">
              <label htmlFor="expiresAt" className="text-sm font-medium">Expires At (Optional)</label>
              <input
                id="expiresAt"
                name="expiresAt"
                type="date"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={formData.expiresAt}
                onChange={handleChange}
              />
            </div>
          </div>
          
          <div className="flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2 pt-4">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={isSubmitting}>{isSubmitting ? "Create Voucher" : "Create Voucher"}</Button>
          </div>
        </form>
      </div>
    </div>
  );
}