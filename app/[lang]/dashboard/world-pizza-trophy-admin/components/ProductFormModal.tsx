import React, { useState } from "react";
import { Button } from "./ui/Button";
import { Product } from "../types";
import { X } from "lucide-react";

interface ProductFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (productData: Omit<Product, "id" | "eventId">) => Promise<void>;
}

export function ProductFormModal({
  isOpen,
  onClose,
  onConfirm,
}: ProductFormModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    stripePriceId: "",
    price: "",
    slotsRequired: "1",
    isPack: false,
    includesMeal: false,
    isActive: true,
  });

  if (!isOpen) return null;

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value, type } = e.target;
    
    if (type === 'checkbox') {
      const checked = (e.target as HTMLInputElement).checked;
      setFormData(prev => ({ ...prev, [name]: checked }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    try {
      await onConfirm({
        name: formData.name,
        description: formData.description,
        stripePriceId: formData.stripePriceId,
        unitAmount: Math.round(parseFloat(formData.price) * 100), // Convert to cents
        slotsRequired: parseInt(formData.slotsRequired, 10),
        isPack: formData.isPack,
        includesMeal: formData.includesMeal,
        isActive: formData.isActive,
      });
      setFormData({
        name: "",
        description: "",
        stripePriceId: "",
        price: "",
        slotsRequired: "1",
        isPack: false,
        includesMeal: false,
        isActive: true,
      });
      onClose();
    } catch (error) {
      console.error("Failed to create product", error);
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
      <div className="fixed z-50 grid w-full max-w-lg scale-100 gap-4 border bg-card text-card-foreground p-6 shadow-lg duration-200 sm:rounded-lg md:w-full overflow-y-auto max-h-[90vh]">
        <div className="flex flex-col space-y-1.5 text-center sm:text-left">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold leading-none tracking-tight">
              Create New Product
            </h2>
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="grid gap-4 py-4">
          <div className="grid gap-2">
            <label htmlFor="name" className="text-sm font-medium">Name</label>
            <input
              id="name"
              name="name"
              type="text"
              required
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={formData.name}
              onChange={handleChange}
            />
          </div>

          <div className="grid gap-2">
            <label htmlFor="description" className="text-sm font-medium">Description</label>
            <textarea
              id="description"
              name="description"
              required
              rows={3}
              className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={formData.description}
              onChange={handleChange}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <label htmlFor="price" className="text-sm font-medium">Price (€)</label>
              <input
                id="price"
                name="price"
                type="number"
                min="0"
                step="0.01"
                required
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={formData.price}
                onChange={handleChange}
              />
            </div>
            <div className="grid gap-2">
              <label htmlFor="stripePriceId" className="text-sm font-medium">Stripe Price ID</label>
              <input
                id="stripePriceId"
                name="stripePriceId"
                type="text"
                required
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={formData.stripePriceId}
                onChange={handleChange}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
             <div className="grid gap-2">
              <label htmlFor="slotsRequired" className="text-sm font-medium">Slots Included</label>
              <input
                id="slotsRequired"
                name="slotsRequired"
                type="number"
                min="1"
                step="1"
                required
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={formData.slotsRequired}
                onChange={handleChange}
              />
            </div>
          </div>

          <div className="flex flex-col gap-2">
             <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="isPack"
                  name="isPack"
                  className="h-4 w-4 rounded border-gray-300 text-primary"
                  checked={formData.isPack}
                  onChange={handleChange}
                />
                <label htmlFor="isPack" className="text-sm font-medium">Is Multi-Slot Pack?</label>
             </div>
             <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="includesMeal"
                  name="includesMeal"
                  className="h-4 w-4 rounded border-gray-300 text-primary"
                  checked={formData.includesMeal}
                  onChange={handleChange}
                />
                <label htmlFor="includesMeal" className="text-sm font-medium">Includes Meal?</label>
             </div>
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="isActive"
                  name="isActive"
                  className="h-4 w-4 rounded border-gray-300 text-primary"
                  checked={formData.isActive}
                  onChange={handleChange}
                />
                <label htmlFor="isActive" className="text-sm font-medium">Active for sale</label>
             </div>
          </div>
          
          <div className="flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2 pt-4">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={isSubmitting}>{isSubmitting ? "Creating..." : "Create Product"}</Button>
          </div>
        </form>
      </div>
    </div>
  );
}