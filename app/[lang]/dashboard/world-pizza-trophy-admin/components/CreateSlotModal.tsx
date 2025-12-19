import React, { useState, useEffect } from "react";
import { Button } from "./ui/Button";
import { Slot, Category } from "../types";
import { X, Layers, AlertTriangle } from "lucide-react";
import { cn } from "../lib/utils";
import { Timestamp } from "firebase/firestore";

interface CreateSlotModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (slotsData: Omit<Slot, "id" | "status" | "userId" | "stripeSessionId" | "eventId">[]) => Promise<void>;
  defaultDate?: string;
  categories: Category[];
}

type CreationMode = 'single' | 'batch';

export function CreateSlotModal({
  isOpen,
  onClose,
  onConfirm,
  defaultDate,
  categories
}: CreateSlotModalProps) {
  const [mode, setMode] = useState<CreationMode>('single');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [previewSlots, setPreviewSlots] = useState<number>(0);
  
  const today = new Date().toISOString().split('T')[0];
  const initialDate = defaultDate || today;
  
  // Only allow creating slots for ACTIVE categories
  const activeCategories = categories.filter(c => c.isActive);
  
  // Safe default
  const defaultCategoryId = activeCategories.length > 0 ? activeCategories[0].id : "";

  const [singleData, setSingleData] = useState({
    date: initialDate,
    categoryId: defaultCategoryId,
    startTime: "10:00",
    endTime: "10:25",
  });

  const [batchData, setBatchData] = useState({
    date: initialDate,
    categoryId: defaultCategoryId,
    dayStartTime: "09:00",
    dayEndTime: "18:00",
    durationMinutes: 25,
    breakMinutes: 5,
  });

  // Update defaults when modal opens or props change
  useEffect(() => {
    if (isOpen) {
      if (defaultDate) {
        setSingleData(prev => ({ ...prev, date: defaultDate }));
        setBatchData(prev => ({ ...prev, date: defaultDate }));
      }
      
      // Ensure selected category is valid for this event and active
      if (activeCategories.length > 0) {
         setSingleData(prev => {
             const exists = activeCategories.find(c => c.id === prev.categoryId);
             return exists ? prev : { ...prev, categoryId: activeCategories[0].id };
         });
         setBatchData(prev => {
             const exists = activeCategories.find(c => c.id === prev.categoryId);
             return exists ? prev : { ...prev, categoryId: activeCategories[0].id };
         });
      }
    }
  }, [isOpen, defaultDate, categories]);

  if (!isOpen) return null;

  const createTimestamp = (dateStr: string, timeStr: string): Timestamp => {
    return Timestamp.fromDate(new Date(`${dateStr}T${timeStr}:00`));
  };

  const handleSingleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setSingleData(prev => ({ ...prev, [name]: value }));
  };

  const handleBatchChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setBatchData(prev => {
      const updated = { ...prev, [name]: value };
      calculatePreview(updated);
      return updated;
    });
  };

  const calculatePreview = (data: typeof batchData) => {
    try {
      const [startH, startM] = data.dayStartTime.split(':').map(Number);
      const [endH, endM] = data.dayEndTime.split(':').map(Number);
      
      const startTotal = startH * 60 + startM;
      const endTotal = endH * 60 + endM;
      const cycle = Number(data.durationMinutes) + Number(data.breakMinutes);

      if (cycle > 0 && endTotal > startTotal) {
        const count = Math.floor((endTotal - startTotal) / cycle);
        setPreviewSlots(count);
      } else {
        setPreviewSlots(0);
      }
    } catch (e) {
      setPreviewSlots(0);
    }
  };

  const generateBatchSlots = () => {
    const slots: Omit<Slot, "id" | "status" | "userId" | "stripeSessionId" | "eventId">[] = [];
    
    let [currentH, currentM] = batchData.dayStartTime.split(':').map(Number);
    const [endH, endM] = batchData.dayEndTime.split(':').map(Number);
    
    const endTotalMinutes = endH * 60 + endM;
    const duration = Number(batchData.durationMinutes);
    const breakTime = Number(batchData.breakMinutes);

    while (true) {
      const currentTotalMinutes = currentH * 60 + currentM;
      const nextEndTotalMinutes = currentTotalMinutes + duration;

      if (nextEndTotalMinutes > endTotalMinutes) break;

      const startStr = `${String(currentH).padStart(2, '0')}:${String(currentM).padStart(2, '0')}`;

      const slotEndH = Math.floor(nextEndTotalMinutes / 60);
      const slotEndM = nextEndTotalMinutes % 60;
      const endStr = `${String(slotEndH).padStart(2, '0')}:${String(slotEndM).padStart(2, '0')}`;

      slots.push({
        date: batchData.date,
        categoryId: batchData.categoryId,
        startTime: createTimestamp(batchData.date, startStr),
        endTime: createTimestamp(batchData.date, endStr),
      });

      const nextStartTotalMinutes = nextEndTotalMinutes + breakTime;
      currentH = Math.floor(nextStartTotalMinutes / 60);
      currentM = nextStartTotalMinutes % 60;
    }

    return slots;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (activeCategories.length === 0) return;

    setIsSubmitting(true);
    
    try {
      if (mode === 'single') {
        await onConfirm([{
          date: singleData.date,
          categoryId: singleData.categoryId,
          startTime: createTimestamp(singleData.date, singleData.startTime),
          endTime: createTimestamp(singleData.date, singleData.endTime),
        }]);
      } else {
        const slots = generateBatchSlots();
        if (slots.length > 0) {
          await onConfirm(slots);
        }
      }
      onClose();
    } catch (error) {
      console.error("Failed to create slots", error);
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
      <div className="fixed z-50 grid w-full max-w-lg scale-100 gap-4 border bg-card text-card-foreground p-0 shadow-lg duration-200 sm:rounded-lg md:w-full overflow-hidden">
        
        <div className="flex flex-col border-b">
          <div className="flex items-center justify-between p-6 pb-4">
            <h2 className="text-lg font-semibold leading-none tracking-tight">
              Create Slots
            </h2>
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
          
          <div className="flex px-6 space-x-4">
            <button
              onClick={() => setMode('single')}
              className={cn(
                "pb-2 text-sm font-medium transition-colors border-b-2",
                mode === 'single' 
                  ? "border-primary text-primary" 
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              Single Slot
            </button>
            <button
              onClick={() => {
                setMode('batch');
                calculatePreview(batchData);
              }}
              className={cn(
                "pb-2 text-sm font-medium transition-colors border-b-2",
                mode === 'batch' 
                  ? "border-primary text-primary" 
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              Batch Generate
            </button>
          </div>
        </div>

        <div className="p-6 pt-4">
            {activeCategories.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-6 text-center space-y-4">
                    <div className="bg-destructive/10 p-4 rounded-full text-destructive">
                        <AlertTriangle className="h-8 w-8" />
                    </div>
                    <div>
                        <h3 className="font-semibold">No Active Categories</h3>
                        <p className="text-sm text-muted-foreground mt-1">
                            You must have at least one active category to create slots.
                        </p>
                    </div>
                    <Button variant="outline" onClick={onClose}>Close</Button>
                </div>
            ) : (
          <form onSubmit={handleSubmit} className="grid gap-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <label className="text-sm font-medium leading-none">
                  Competition Date
                </label>
                <input
                  name="date"
                  type="date"
                  required
                  className="flex h-10 w-full rounded-md border border-input bg-background text-foreground px-3 py-2 text-sm ring-offset-background [color-scheme:light] dark:[color-scheme:dark]"
                  value={mode === 'single' ? singleData.date : batchData.date}
                  onChange={mode === 'single' ? handleSingleChange : handleBatchChange}
                />
              </div>
              <div className="grid gap-2">
                <label className="text-sm font-medium leading-none">
                  Category
                </label>
                <select
                  name="categoryId"
                  required
                  className="flex h-10 w-full rounded-md border border-input bg-background text-foreground px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  value={mode === 'single' ? singleData.categoryId : batchData.categoryId}
                  onChange={mode === 'single' ? handleSingleChange : handleBatchChange}
                >
                  {activeCategories.map(cat => (
                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                  ))}
                </select>
              </div>
            </div>

            {mode === 'single' ? (
              <div className="grid grid-cols-2 gap-4 animate-in fade-in slide-in-from-left-4 duration-300">
                <div className="grid gap-2">
                  <label className="text-sm font-medium leading-none">Start Time</label>
                  <input
                    name="startTime"
                    type="time"
                    required
                    className="flex h-10 w-full rounded-md border border-input bg-background text-foreground px-3 py-2 text-sm [color-scheme:light] dark:[color-scheme:dark]"
                    value={singleData.startTime}
                    onChange={handleSingleChange}
                  />
                </div>
                <div className="grid gap-2">
                  <label className="text-sm font-medium leading-none">End Time</label>
                  <input
                    name="endTime"
                    type="time"
                    required
                    className="flex h-10 w-full rounded-md border border-input bg-background text-foreground px-3 py-2 text-sm [color-scheme:light] dark:[color-scheme:dark]"
                    value={singleData.endTime}
                    onChange={handleSingleChange}
                  />
                </div>
              </div>
            ) : (
              <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
                <div className="p-4 bg-muted/50 rounded-lg border space-y-4">
                   <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <label className="text-sm font-medium leading-none">Day Start</label>
                      <input
                        name="dayStartTime"
                        type="time"
                        required
                        className="flex h-10 w-full rounded-md border border-input bg-background text-foreground px-3 py-2 text-sm [color-scheme:light] dark:[color-scheme:dark]"
                        value={batchData.dayStartTime}
                        onChange={handleBatchChange}
                      />
                    </div>
                    <div className="grid gap-2">
                      <label className="text-sm font-medium leading-none">Day End</label>
                      <input
                        name="dayEndTime"
                        type="time"
                        required
                        className="flex h-10 w-full rounded-md border border-input bg-background text-foreground px-3 py-2 text-sm [color-scheme:light] dark:[color-scheme:dark]"
                        value={batchData.dayEndTime}
                        onChange={handleBatchChange}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <label className="text-sm font-medium leading-none">Slot Duration (min)</label>
                      <input
                        name="durationMinutes"
                        type="number"
                        min="1"
                        required
                        className="flex h-10 w-full rounded-md border border-input bg-background text-foreground px-3 py-2 text-sm"
                        value={batchData.durationMinutes}
                        onChange={handleBatchChange}
                      />
                    </div>
                    <div className="grid gap-2">
                      <label className="text-sm font-medium leading-none">Break Time (min)</label>
                      <input
                        name="breakMinutes"
                        type="number"
                        min="0"
                        required
                        className="flex h-10 w-full rounded-md border border-input bg-background text-foreground px-3 py-2 text-sm"
                        value={batchData.breakMinutes}
                        onChange={handleBatchChange}
                      />
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 text-sm text-muted-foreground bg-accent/30 p-3 rounded text-center justify-center">
                  <Layers className="h-4 w-4" />
                  <span>Will generate approximately <strong>{previewSlots}</strong> slots</span>
                </div>
              </div>
            )}
            
            <div className="flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2 pt-4 border-t mt-2">
              <Button type="button" variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting || (mode === 'batch' && previewSlots <= 0)}>
                {isSubmitting ? "Creating..." : mode === 'batch' ? `Generate ${previewSlots > 0 ? previewSlots : ''} Slots` : "Create Slot"}
              </Button>
            </div>
          </form>
          )}
        </div>
      </div>
    </div>
  );
}
