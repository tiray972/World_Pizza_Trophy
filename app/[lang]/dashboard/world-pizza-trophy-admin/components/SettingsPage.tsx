import React, { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/Card";
import { Button } from "./ui/Button";
import { WPTEvent, EventStatus } from "@/types/firestore";
import { Timestamp } from "firebase/firestore";
import { Calendar, Save, AlertCircle, Plus, Activity } from "lucide-react";
import { cn } from "../lib/utils";

interface SettingsPageProps {
  event: WPTEvent | undefined;
  onUpdateEvent: (updatedEvent: WPTEvent) => void;
  onCreateEvent: () => void;
}

export function SettingsPage({ event, onUpdateEvent, onCreateEvent }: SettingsPageProps) {
  const [formData, setFormData] = useState({
    name: "",
    eventYear: new Date().getFullYear(),
    startDate: "",
    endDate: "",
    regDeadline: "",
    status: "draft" as EventStatus,
  });

  const [isSaving, setIsSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Sync form data when event changes
  useEffect(() => {
    if (event) {
      setFormData({
        name: event.name,
        eventYear: event.eventYear,
        startDate: event.eventStartDate.toDate().toISOString().split('T')[0],
        endDate: event.eventEndDate.toDate().toISOString().split('T')[0],
        regDeadline: event.registrationDeadline.toDate().toISOString().split('T')[0],
        status: event.status,
      });
    }
  }, [event]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    setSuccessMsg(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!event) return;

    setIsSaving(true);

    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 800));

      const updatedEvent: WPTEvent = {
        ...event,
        name: formData.name,
        eventYear: Number(formData.eventYear),
        eventStartDate: Timestamp.fromDate(new Date(formData.startDate)),
        eventEndDate: Timestamp.fromDate(new Date(formData.endDate)),
        registrationDeadline: Timestamp.fromDate(new Date(formData.regDeadline)),
        status: formData.status,
      };

      onUpdateEvent(updatedEvent);
      setSuccessMsg("Event configuration updated successfully.");
    } catch (err) {
      console.error(err);
    } finally {
      setIsSaving(false);
    }
  };

  if (!event) {
    return (
      <div className="flex flex-col items-center justify-center h-[50vh] space-y-4 text-center">
        <div className="p-4 bg-muted rounded-full">
          <Calendar className="h-10 w-10 text-muted-foreground" />
        </div>
        <h2 className="text-xl font-semibold">No Event Selected</h2>
        <p className="text-muted-foreground max-w-sm">
          Please select an event from the sidebar or create a new one to start managing slots and registrations.
        </p>
        <Button onClick={onCreateEvent}>
          <Plus className="mr-2 h-4 w-4" />
          Create First Event
        </Button>
      </div>
    );
  }

  const getStatusColor = (s: EventStatus) => {
    switch (s) {
      case 'open': return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 border-green-200 dark:border-green-800';
      case 'draft': return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400 border-yellow-200 dark:border-yellow-800';
      case 'closed': return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 border-red-200 dark:border-red-800';
      case 'archived': return 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400 border-gray-200 dark:border-gray-700';
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold tracking-tight">Event Configuration</h2>
            <p className="text-muted-foreground">
              Update parameters for <strong>{event.name}</strong>.
            </p>
          </div>
          <div className={cn("px-3 py-1 rounded-full text-sm font-medium border capitalize", getStatusColor(event.status))}>
            {event.status}
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-primary" />
              Event Details
            </CardTitle>
            <CardDescription>
              Basic info, schedule bounds, and lifecycle status.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            
            <div className="p-4 bg-muted/50 rounded-lg border space-y-3">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Activity className="h-4 w-4" />
                Event Lifecycle Status
              </div>
              <select
                name="status"
                value={formData.status}
                onChange={handleChange}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:ring-2 focus:ring-primary"
              >
                <option value="draft">Draft - Configuration Only (Hidden from Public)</option>
                <option value="open">Open - Active & Registrations Enabled</option>
                <option value="closed">Closed - Registrations Disabled</option>
                <option value="archived">Archived - Read-only History</option>
              </select>
              <div className="text-xs text-muted-foreground">
                <ul className="list-disc pl-4 space-y-1">
                  <li><strong>Draft:</strong> Use this to set up categories and slots before going live.</li>
                  <li><strong>Open:</strong> The main active state. Allows users to register.</li>
                  <li><strong>Closed:</strong> Use this when the event is over or full.</li>
                </ul>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Event Name */}
              <div className="grid gap-2">
                <label htmlFor="name" className="text-sm font-medium">Event Name</label>
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

              {/* Year */}
              <div className="grid gap-2">
                <label htmlFor="eventYear" className="text-sm font-medium">Event Year</label>
                <input
                  id="eventYear"
                  name="eventYear"
                  type="number"
                  min="2024"
                  max="2030"
                  required
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={formData.eventYear}
                  onChange={handleChange}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Start Date */}
              <div className="grid gap-2">
                <label htmlFor="startDate" className="text-sm font-medium">Start Date</label>
                <input
                  id="startDate"
                  name="startDate"
                  type="date"
                  required
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={formData.startDate}
                  onChange={handleChange}
                />
              </div>

              {/* End Date */}
              <div className="grid gap-2">
                <label htmlFor="endDate" className="text-sm font-medium">End Date</label>
                <input
                  id="endDate"
                  name="endDate"
                  type="date"
                  required
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={formData.endDate}
                  onChange={handleChange}
                />
              </div>

              {/* Deadline */}
              <div className="grid gap-2">
                <label htmlFor="regDeadline" className="text-sm font-medium text-destructive">Registration Deadline</label>
                <input
                  id="regDeadline"
                  name="regDeadline"
                  type="date"
                  required
                  className="flex h-10 w-full rounded-md border border-destructive/50 bg-background px-3 py-2 text-sm focus:ring-destructive"
                  value={formData.regDeadline}
                  onChange={handleChange}
                />
              </div>
            </div>

            <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-md flex items-start gap-3 border border-blue-100 dark:border-blue-800">
              <AlertCircle className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5" />
              <div className="text-sm text-blue-800 dark:text-blue-300">
                <strong>Note:</strong> Modifying dates does not auto-delete existing slots. 
                Manage slots manually in the Slots tab if dates change significantly.
              </div>
            </div>

          </CardContent>
          
          <div className="flex items-center justify-between border-t p-6 bg-muted/40">
             <div className="text-sm font-medium text-green-600">
               {successMsg && successMsg}
             </div>
             <Button type="submit" disabled={isSaving} className="min-w-[150px]">
               {isSaving ? "Saving..." : "Update Event"}
               {!isSaving && <Save className="ml-2 h-4 w-4" />}
             </Button>
          </div>
        </Card>
      </form>
    </div>
  );
}
