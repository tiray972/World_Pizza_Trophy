import React, { useState } from "react";
import { Button } from "./ui/Button";
import { Slot } from "../types";
import { X, Layers, Calendar, Clock } from "lucide-react";
import { cn } from "../lib/utils";

interface CreateSlotModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (slotsData: Omit<Slot, "id" | "status" | "userId" | "userFullName">[]) => Promise<void>;
}

const CATEGORIES = [
  "Classic",
  "Calzone",
  "Napo",
  "Pasta",
  "Focaccia",
  "Pizza dessert",
  "Dué",
  "Freestyle",
  "rapidité",
  "Large",
  "Telia"
];

type CreationMode = 'single' | 'batch';

export function CreateSlotModal({
  isOpen,
  onClose,
  onConfirm,
}: CreateSlotModalProps) {
  const [mode, setMode] = useState<CreationMode>('single');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [previewSlots, setPreviewSlots] = useState<number>(0);
  
  // Default to today's date
  const today = new Date().toISOString().split('T')[0];

  // State for Single Mode
  const [singleData, setSingleData] = useState({
    date: today,
    category: CATEGORIES[0],
    startTime: "10:00",
    endTime: "10:25",
  });

  // State for Batch Mode
  const [batchData, setBatchData] = useState({
    date: today,
    category: CATEGORIES[0],
    dayStartTime: "09:00",
    dayEndTime: "18:00",
    durationMinutes: 25,
    breakMinutes: 5,
  });

  if (!isOpen) return null;

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
      // Recalculate preview count on change
      calculatePreview(updated);
      return updated;
    });
  };

  const calculatePreview = (data: typeof batchData) => {
    // Simple estimation of how many slots will be created
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
    const slots: Omit<Slot, "id" | "status" | "userId" | "userFullName">[] = [];
    
    let [currentH, currentM] = batchData.dayStartTime.split(':').map(Number);
    const [endH, endM] = batchData.dayEndTime.split(':').map(Number);
    
    const endTotalMinutes = endH * 60 + endM;
    const duration = Number(batchData.durationMinutes);
    const breakTime = Number(batchData.breakMinutes);

    while (true) {
      const currentTotalMinutes = currentH * 60 + currentM;
      const nextEndTotalMinutes = currentTotalMinutes + duration;

      // Stop if the slot ends after the day end time
      if (nextEndTotalMinutes > endTotalMinutes) break;

      // Format Start Time
      const startStr = `${String(currentH).padStart(2, '0')}:${String(currentM).padStart(2, '0')}`;

      // Calculate End Time
      const slotEndH = Math.floor(nextEndTotalMinutes / 60);
      const slotEndM = nextEndTotalMinutes % 60;
      const endStr = `${String(slotEndH).padStart(2, '0')}:${String(slotEndM).padStart(2, '0')}`;

      slots.push({
        date: batchData.date,
        category: batchData.category,
        startTime: startStr,
        endTime: endStr,
      });

      // Advance time by Duration + Break
      const nextStartTotalMinutes = nextEndTotalMinutes + breakTime;
      currentH = Math.floor(nextStartTotalMinutes / 60);
      currentM = nextStartTotalMinutes % 60;
    }

    return slots;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    try {
      if (mode === 'single') {
        await onConfirm([{
          date: singleData.date,
          category: singleData.category,
          startTime: singleData.startTime,
          endTime: singleData.endTime,
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
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-background/80 backdrop-blur-sm transition-opacity" 
        onClick={onClose}
      />
      
      {/* Dialog */}
      <div className="fixed z-50 grid w-full max-w-lg scale-100 gap-4 border bg-card text-card-foreground p-0 shadow-lg duration-200 sm:rounded-lg md:w-full overflow-hidden">
        
        {/* Header with Tabs */}
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
          <form onSubmit={handleSubmit} className="grid gap-4">
            
            {/* Common Fields */}
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
                  name="category"
                  required
                  className="flex h-10 w-full rounded-md border border-input bg-background text-foreground px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  value={mode === 'single' ? singleData.category : batchData.category}
                  onChange={mode === 'single' ? handleSingleChange : handleBatchChange}
                >
                  {CATEGORIES.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Mode Specific Fields */}
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
        </div>
      </div>
    </div>
  );
}