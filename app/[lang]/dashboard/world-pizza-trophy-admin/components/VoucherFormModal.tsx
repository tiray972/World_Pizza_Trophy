import React, { useState } from "react";
import { Button } from "./ui/Button";
import { Voucher } from "../types";
import { X } from "lucide-react";

interface VoucherFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (voucherData: Omit<Voucher, "id" | "isUsed">) => Promise<void>;
}

// Mock products for the dropdown
const PRODUCT_OPTIONS = [
  "Single Competitor Entry",
  "Team Pack (3 Entries)",
  "Early Bird Special",
  "VIP Pass"
];

export function VoucherFormModal({
  isOpen,
  onClose,
  onConfirm,
}: VoucherFormModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    code: "",
    productName: PRODUCT_OPTIONS[0],
    isSingleUse: "true", // Store as string for select/radio handling ease
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
        productName: formData.productName,
        isSingleUse: formData.isSingleUse === "true",
        expiresAt: formData.expiresAt || undefined,
      });
      
      // Reset form
      setFormData({
        code: "",
        productName: PRODUCT_OPTIONS[0],
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
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-background/80 backdrop-blur-sm transition-opacity" 
        onClick={onClose}
      />
      
      {/* Dialog */}
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
            <label htmlFor="code" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
              Voucher Code
            </label>
            <input
              id="code"
              name="code"
              type="text"
              required
              className="flex h-10 w-full rounded-md border border-input bg-background text-foreground px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 uppercase"
              placeholder="e.g. PIZZA2025"
              value={formData.code}
              onChange={handleChange}
            />
          </div>

          <div className="grid gap-2">
            <label htmlFor="productName" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
              Applicable Product
            </label>
            <select
              id="productName"
              name="productName"
              required
              className="flex h-10 w-full rounded-md border border-input bg-background text-foreground px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              value={formData.productName}
              onChange={handleChange}
            >
              {PRODUCT_OPTIONS.map((prod) => (
                <option key={prod} value={prod} className="bg-background text-foreground">
                  {prod}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <label htmlFor="isSingleUse" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                Usage Type
              </label>
              <select
                id="isSingleUse"
                name="isSingleUse"
                className="flex h-10 w-full rounded-md border border-input bg-background text-foreground px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                value={formData.isSingleUse}
                onChange={handleChange}
              >
                <option value="true" className="bg-background text-foreground">Single Use</option>
                <option value="false" className="bg-background text-foreground">Multi-use (Unlimited)</option>
              </select>
            </div>
            <div className="grid gap-2">
              <label htmlFor="expiresAt" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                Expires At (Optional)
              </label>
              <input
                id="expiresAt"
                name="expiresAt"
                type="date"
                className="flex h-10 w-full rounded-md border border-input bg-background text-foreground px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 [color-scheme:light] dark:[color-scheme:dark]"
                value={formData.expiresAt}
                onChange={handleChange}
              />
            </div>
          </div>
          
          <div className="flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2 pt-4">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Creating..." : "Create Voucher"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}