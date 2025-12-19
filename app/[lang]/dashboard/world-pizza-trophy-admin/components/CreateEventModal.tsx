"use client";
import React, { useState } from "react";
import { Button } from "./ui/Button";
import { WPTEvent } from "@/types/firestore";
import { X, Calendar, Copy, Star, FileText, Zap } from "lucide-react";

interface CreateEventModalProps {
  isOpen: boolean;
  onClose: () => void;
  /**
   * Called when user confirms event creation.
   * @param eventData - Base event info (name, year, dates)
   * @param copyFromEventId - Source for duplication:
   *   - "default_template": Use WPT_DEFAULT_TEMPLATE_* from mockData.ts
   *   - null: Create empty event (no categories/products)
   *   - "<eventId>": Copy from existing event
   */
  onConfirm: (eventData: Omit<WPTEvent, "id" | "status">, copyFromEventId: string | null) => Promise<void>;
  existingEvents: WPTEvent[];
}

export function CreateEventModal({
  isOpen,
  onClose,
  onConfirm,
  existingEvents
}: CreateEventModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [copyFromId, setCopyFromId] = useState<string>("default_template");
  
  const [formData, setFormData] = useState({
    name: "",
    eventYear: new Date().getFullYear() + 1,
    eventStartDate: "",
    eventEndDate: "",
    registrationDeadline: "",
  });

  if (!isOpen) return null;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    try {
      await onConfirm({
        name: formData.name,
        eventYear: Number(formData.eventYear),
        eventStartDate: new Date(formData.eventStartDate),
        eventEndDate: new Date(formData.eventEndDate),
        registrationDeadline: new Date(formData.registrationDeadline),
      }, copyFromId || null);
      
      onClose();
    } catch (error) {
      console.error("Failed to create event", error);
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
            <h2 className="text-lg font-semibold leading-none tracking-tight flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Create New Event
            </h2>
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
          <p className="text-sm text-muted-foreground">
            Configure a new edition of the World Pizza Trophy with categories, products, and settings.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="grid gap-4 py-4">
          
          {/* Content Initialization Strategy */}
          <div className="p-4 bg-muted/30 rounded-lg border mb-2 space-y-3">
              <div className="flex items-center gap-2">
                  <Zap className="h-4 w-4 text-amber-500" />
                  <span className="text-sm font-medium">Quick Start - Initialize Content From:</span>
              </div>
              
              <div className="grid gap-3">
                  <select
                      id="copyFrom"
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-medium focus:ring-2 focus:ring-primary"
                      value={copyFromId}
                      onChange={(e) => setCopyFromId(e.target.value)}
                  >
                      <optgroup label="🎯 Official Template">
                        <option value="default_template">
                           WPT Standard Template (Recommended)
                        </option>
                      </optgroup>
                      
                      <optgroup label="📝 Manual Setup">
                        <option value="">
                           Empty Event (Custom Setup)
                        </option>
                      </optgroup>
                      
                      {existingEvents.length > 0 && (
                        <optgroup label="📋 Duplicate From History">
                          {existingEvents.map(evt => (
                              <option key={evt.id} value={evt.id}>
                                  {evt.name} ({evt.eventYear})
                              </option>
                          ))}
                        </optgroup>
                      )}
                  </select>
                  
                  {/* Dynamic Help Text based on selection */}
                  <div className="text-xs text-muted-foreground px-1 mt-2 space-y-2">
                    {copyFromId === 'default_template' && (
                      <div className="flex items-start gap-3 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                        <Star className="h-4 w-4 fill-blue-500 text-blue-500 shrink-0 mt-0.5" />
                        <div className="flex flex-col gap-1">
                          <strong className="text-blue-900 dark:text-blue-200">Recommended: WPT Standard</strong>
                          <span className="text-blue-700 dark:text-blue-300">
                            Pre-loads all official WPT categories (Classique, Napolitaine, Pala, etc.) and standard packs. Perfect for consistency across events.
                          </span>
                          <span className="text-blue-600 dark:text-blue-400 text-xs mt-1">
                            ✓ Fully editable • All data is duplicated with new IDs
                          </span>
                        </div>
                      </div>
                    )}
                    {copyFromId === '' && (
                      <div className="flex items-start gap-3 p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200 dark:border-yellow-800">
                        <FileText className="h-4 w-4 text-yellow-600 dark:text-yellow-400 shrink-0 mt-0.5" />
                        <div className="flex flex-col gap-1">
                          <strong className="text-yellow-900 dark:text-yellow-200">Custom Setup</strong>
                          <span className="text-yellow-700 dark:text-yellow-300">
                            Creates a completely empty event. You will manually define all categories, products, and packs.
                          </span>
                          <span className="text-yellow-600 dark:text-yellow-400 text-xs mt-1">
                            ⚠️ Requires full manual configuration
                          </span>
                        </div>
                      </div>
                    )}
                    {copyFromId !== '' && copyFromId !== 'default_template' && (
                      <div className="flex items-start gap-3 p-3 bg-slate-100 dark:bg-slate-800 rounded-lg border border-slate-300 dark:border-slate-700">
                        <Copy className="h-4 w-4 text-slate-600 dark:text-slate-400 shrink-0 mt-0.5" />
                        <div className="flex flex-col gap-1">
                          <strong className="text-slate-900 dark:text-slate-100">Duplicate From Previous Event</strong>
                          <span className="text-slate-700 dark:text-slate-300">
                            Copies exact categories and products from the selected previous event. All IDs are regenerated.
                          </span>
                          <span className="text-slate-600 dark:text-slate-400 text-xs mt-1">
                            ✓ Fully editable • Links and dates will be updated to new event
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
              </div>
          </div>

          {/* Event Details Section */}
          <div className="space-y-4 pt-2">
            <h3 className="text-sm font-semibold text-muted-foreground">Event Details</h3>
            
            <div className="grid gap-2">
              <label htmlFor="name" className="text-sm font-medium">Event Name</label>
              <input
                id="name"
                name="name"
                type="text"
                required
                placeholder="e.g. WPT 2027 Paris"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={formData.name}
                onChange={handleChange}
              />
            </div>

            <div className="grid gap-2">
              <label htmlFor="eventYear" className="text-sm font-medium">Year</label>
              <input
                id="eventYear"
                name="eventYear"
                type="number"
                required
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={formData.eventYear}
                onChange={handleChange}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <label htmlFor="eventStartDate" className="text-sm font-medium">Start Date</label>
                <input
                  id="eventStartDate"
                  name="eventStartDate"
                  type="date"
                  required
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={formData.eventStartDate}
                  onChange={handleChange}
                />
              </div>
              <div className="grid gap-2">
                <label htmlFor="eventEndDate" className="text-sm font-medium">End Date</label>
                <input
                  id="eventEndDate"
                  name="eventEndDate"
                  type="date"
                  required
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={formData.eventEndDate}
                  onChange={handleChange}
                />
              </div>
            </div>

            <div className="grid gap-2">
               <label htmlFor="registrationDeadline" className="text-sm font-medium text-destructive">Registration Deadline</label>
                <input
                  id="registrationDeadline"
                  name="registrationDeadline"
                  type="date"
                  required
                  className="flex h-10 w-full rounded-md border border-destructive/50 bg-background px-3 py-2 text-sm"
                  value={formData.registrationDeadline}
                  onChange={handleChange}
                />
            </div>
          </div>
          
          <div className="flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2 pt-4">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Creating..." : "Create Event"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
