import React, { useState, useEffect } from "react";
import { Button } from "./ui/Button";
import { Category } from "@/types/firestore";
import { X } from "lucide-react";

interface CategoryFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (categoryData: Partial<Category>) => void;
  initialData?: Category | null;
  mode: 'create' | 'edit';
}

export function CategoryFormModal({
  isOpen,
  onClose,
  onConfirm,
  initialData,
  mode
}: CategoryFormModalProps) {
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    unitPrice: 100,
    maxSlots: 20,
    durationMinutes: 15,
    rules: "",
    isActive: true
  });

  useEffect(() => {
    if (isOpen && initialData && mode === 'edit') {
      setFormData({
        name: initialData.name,
        description: initialData.description,
        unitPrice: initialData.unitPrice,
        maxSlots: initialData.maxSlots,
        durationMinutes: initialData.durationMinutes,
        rules: initialData.rules || "",
        isActive: initialData.isActive !== undefined ? initialData.isActive : true
      });
    } else if (isOpen && mode === 'create') {
      // Reset for create mode
      setFormData({
        name: "",
        description: "",
        unitPrice: 100,
        maxSlots: 20,
        durationMinutes: 15,
        rules: "",
        isActive: true
      });
    }
  }, [isOpen, initialData, mode]);

  if (!isOpen) return null;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    
    if (type === 'checkbox') {
        const checked = (e.target as HTMLInputElement).checked;
        setFormData(prev => ({ ...prev, [name]: checked }));
    } else {
        setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onConfirm({
      name: formData.name,
      description: formData.description,
      unitPrice: Number(formData.unitPrice),
      maxSlots: Number(formData.maxSlots),
      durationMinutes: Number(formData.durationMinutes),
      rules: formData.rules,
      isActive: formData.isActive
    });
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
              {mode === 'create' ? "Add New Category" : "Edit Category"}
            </h2>
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
          <p className="text-sm text-muted-foreground">
            {mode === 'create' 
              ? "Define a new category for this competition event." 
              : "Update settings for this category. Changes to Duration do not affect existing slots."}
          </p>
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
            <input
              id="description"
              name="description"
              type="text"
              required
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={formData.description}
              onChange={handleChange}
            />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="grid gap-2">
              <label htmlFor="unitPrice" className="text-sm font-medium">Price (€)</label>
              <input
                id="unitPrice"
                name="unitPrice"
                type="number"
                min="0"
                required
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={formData.unitPrice}
                onChange={handleChange}
              />
            </div>
            <div className="grid gap-2">
              <label htmlFor="durationMinutes" className="text-sm font-medium">Duration (min)</label>
              <input
                id="durationMinutes"
                name="durationMinutes"
                type="number"
                min="1"
                required
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={formData.durationMinutes}
                onChange={handleChange}
              />
            </div>
            <div className="grid gap-2">
              <label htmlFor="maxSlots" className="text-sm font-medium">Max Slots</label>
              <input
                id="maxSlots"
                name="maxSlots"
                type="number"
                min="1"
                required
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={formData.maxSlots}
                onChange={handleChange}
              />
            </div>
          </div>

          <div className="grid gap-2">
            <label htmlFor="rules" className="text-sm font-medium">Rules & Regulations</label>
            <textarea
              id="rules"
              name="rules"
              rows={4}
              placeholder="Enter detailed rules, PDF links, or specific requirements here..."
              className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={formData.rules}
              onChange={handleChange}
            />
          </div>
          
          <div className="flex items-center space-x-2 pt-2">
             <input
               type="checkbox"
               id="isActive"
               name="isActive"
               className="h-4 w-4 rounded border-gray-300 text-primary"
               checked={formData.isActive}
               onChange={handleChange}
             />
             <label htmlFor="isActive" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
               Active (Visible for creating slots)
             </label>
          </div>

          <div className="flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2 pt-4">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit">
              {mode === 'create' ? "Create Category" : "Save Changes"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
