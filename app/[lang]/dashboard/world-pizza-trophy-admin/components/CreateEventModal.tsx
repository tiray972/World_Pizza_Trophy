import React, { useState } from "react";
import { Button } from "./ui/Button";
import { WPTEvent } from "../types";
import { X, Calendar, Copy, Star, FileText } from "lucide-react";
import { Timestamp } from "firebase/firestore";

interface CreateEventModalProps {
  isOpen: boolean;
  onClose: () => void;
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
        eventStartDate: Timestamp.fromDate(new Date(formData.eventStartDate)),
        eventEndDate: Timestamp.fromDate(new Date(formData.eventEndDate)),
        registrationDeadline: Timestamp.fromDate(new Date(formData.registrationDeadline)),
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
            Configure a new edition of the World Pizza Trophy.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="grid gap-4 py-4">
          
          {/* Content Initialization Strategy */}
          <div className="p-4 bg-muted/30 rounded-lg border mb-2 space-y-3">
              <div className="flex items-center gap-2">
                  <Copy className="h-4 w-4 text-blue-500" />
                  <span className="text-sm font-medium">Initialize Content From:</span>
              </div>
              
              <div className="grid gap-2">
                  <select
                      id="copyFrom"
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-medium focus:ring-2 focus:ring-primary"
                      value={copyFromId}
                      onChange={(e) => setCopyFromId(e.target.value)}
                  >
                      <optgroup label="Templates">
                        <option value="default_template">
                           WPT Standard Template (Default)
                        </option>
                        <option value="">
                           Empty Event (Start Fresh)
                        </option>
                      </optgroup>
                      
                      {existingEvents.length > 0 && (
                        <optgroup label="History">
                          {existingEvents.map(evt => (
                              <option key={evt.id} value={evt.id}>
                                  Copy from {evt.name} ({evt.eventYear})
                              </option>
                          ))}
                        </optgroup>
                      )}
                  </select>
                  
                  <div className="text-xs text-muted-foreground px-1 mt-1">
                    {copyFromId === 'default_template' && (
                      <div className="flex items-start gap-2 p-2 bg-blue-50 dark:bg-blue-900/20 rounded border border-blue-100 dark:border-blue-800 text-blue-700 dark:text-blue-300">
                        <Star className="h-4 w-4 fill-current shrink-0 mt-0.5" />
                        <span>
                          <strong>Recommended:</strong> Pre-loads the official WPT categories (Classique, Napolitaine, etc.) and standard packs.
                        </span>
                      </div>
                    )}
                    {copyFromId === '' && (
                      <div className="flex items-start gap-2 p-2 bg-yellow-50 dark:bg-yellow-900/20 rounded border border-yellow-100 dark:border-yellow-800 text-yellow-700 dark:text-yellow-300">
                        <FileText className="h-4 w-4 shrink-0 mt-0.5" />
                        <span>
                          Creates a completely empty event. You will need to define all categories and products manually.
                        </span>
                      </div>
                    )}
                    {copyFromId !== '' && copyFromId !== 'default_template' && (
                      <div className="flex items-start gap-2 p-2 bg-gray-50 dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700">
                        <Copy className="h-4 w-4 shrink-0 mt-0.5" />
                        <span>
                          Duplicates exact categories and products from the selected previous event.
                        </span>
                      </div>
                    )}
                  </div>
              </div>
          </div>

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
