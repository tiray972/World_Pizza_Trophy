import React, { useState, useMemo, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/Card";
import { Button } from "./ui/Button";
import { Badge } from "./ui/Badge";
import { Slot, User, SlotStatus, Category, WPTEvent } from "../types";
import { AssignSlotModal } from "./AssignSlotModal";
import { CreateSlotModal } from "./CreateSlotModal";
import { DeleteConfirmationModal } from "./DeleteConfirmationModal";
import { Clock, User as UserIcon, Loader2, FileSpreadsheet, Plus, CalendarDays, Trash2, Eraser, AlertTriangle, Lock, ShieldAlert, UserCog } from "lucide-react";
import { formatTime, formatUser } from "../lib/utils";
import { Timestamp } from "firebase/firestore";

interface SlotsPageProps {
  slots: Slot[];
  users: User[];
  categories: Category[];
  selectedEvent: WPTEvent | undefined; // Pass current event
  onUpdateSlot: (slot: Slot) => void;
  onCreateSlot: (slotsData: Omit<Slot, "id" | "status" | "userId" | "stripeSessionId" | "eventId">[]) => Promise<void>;
  onDeleteSlot: (slotId: string) => Promise<void>;
  onDeleteDate: (date: string) => Promise<void>;
}

export function SlotsPage({ 
  slots, 
  users, 
  categories, 
  selectedEvent,
  onUpdateSlot, 
  onCreateSlot, 
  onDeleteSlot, 
  onDeleteDate 
}: SlotsPageProps) {
  
  // Only show slots belonging to current event (parent filters this, but good to be safe if parent didn't)
  const eventSlots = useMemo(() => {
    if (!selectedEvent) return [];
    return slots.filter(s => s.eventId === selectedEvent.id);
  }, [slots, selectedEvent]);

  // Determine available dates from the event slots
  const availableDates = useMemo(() => {
    const dates = Array.from(new Set(eventSlots.map(s => s.date))).sort();
    return dates;
  }, [eventSlots]);

  // Set active date
  const [activeDate, setActiveDate] = useState<string>("");

  useEffect(() => {
    if (availableDates.length > 0 && (!activeDate || !availableDates.includes(activeDate))) {
      setActiveDate(availableDates[0]);
    } else if (availableDates.length === 0) {
      setActiveDate("");
    }
  }, [availableDates, activeDate]);

  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  
  // Deletion State
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [slotToDelete, setSlotToDelete] = useState<Slot | null>(null);
  const [isDeletingDate, setIsDeletingDate] = useState(false);

  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);

  // Filter slots for current date view
  const currentSlots = eventSlots
    .filter(s => s.date === activeDate)
    .sort((a, b) => a.startTime.toMillis() - b.startTime.toMillis());

  const getStatusBadge = (status: SlotStatus) => {
    switch (status) {
      case 'available': return <Badge variant="secondary">Available</Badge>;
      case 'paid': return <Badge variant="success">Paid</Badge>;
      case 'offered': return <Badge variant="warning">Offered</Badge>;
      case 'locked': return <Badge variant="outline">Locked</Badge>;
      default: return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getCategoryName = (categoryId: string) => {
    return categories.find(c => c.id === categoryId)?.name || "Unknown Category";
  };

  const handleAssignClick = (slot: Slot) => {
    setSelectedSlot(slot);
    setIsAssignModalOpen(true);
  };

  const handleCreateConfirm = async (slotsData: Omit<Slot, "id" | "status" | "userId" | "stripeSessionId" | "eventId">[]) => {
    await onCreateSlot(slotsData);
    if (slotsData.length > 0) {
      setActiveDate(slotsData[0].date);
    }
  };

  const handleAssignConfirm = async (userId: string) => {
    setIsSyncing(true);
    setSyncMessage("Logging action...");
    
    await new Promise(resolve => setTimeout(resolve, 600));

    const user = users.find(u => u.id === userId);
    const isPaid = (selectedEvent && user?.registrations[selectedEvent.id]?.paid) || false;
    const newStatus: SlotStatus = isPaid ? 'paid' : 'offered';

    setSyncMessage("Syncing to Database...");
    await new Promise(resolve => setTimeout(resolve, 800));

    if (selectedSlot) {
      const updatedSlot: Slot = {
        ...selectedSlot,
        userId,
        status: newStatus,
        // Traceability Fields
        assignedByAdminId: 'admin_current', // Mock ID for the active admin
        assignedAt: Timestamp.now(),
        assignmentType: 'manual'
      };

      onUpdateSlot(updatedSlot);
      console.log(`[AUDIT] Slot ${selectedSlot.id} manually assigned to User ${userId} by admin.`);
    }

    setIsSyncing(false);
    setSyncMessage(null);
  };

  // --- Deletion Handlers ---

  const initiateDeleteSlot = (slot: Slot) => {
    setSlotToDelete(slot);
    setIsDeletingDate(false);
    setIsDeleteModalOpen(true);
  };

  const initiateDeleteDate = () => {
    if (!activeDate) return;
    setSlotToDelete(null);
    setIsDeletingDate(true);
    setIsDeleteModalOpen(true);
  };

  const handleConfirmDelete = async () => {
    // 1. Paid Slot Protection
    if (slotToDelete?.status === 'paid') {
      alert("PROTECTION ALERT: You cannot delete a 'PAID' slot directly.\n\nPlease refund the transaction or manually release the slot first to acknowledge the financial change.");
      setIsDeleteModalOpen(false);
      return;
    }

    // 2. Date Deletion Logic (Prevent delete if any slot is paid)
    if (isDeletingDate && activeDate) {
      const hasPaidSlots = currentSlots.some(s => s.status === 'paid');
      if (hasPaidSlots) {
        alert("PROTECTION ALERT: This date contains 'PAID' slots. You cannot bulk delete it.\n\nPlease resolve the paid slots individually first.");
        setIsDeleteModalOpen(false);
        return;
      }
      
      console.log(`[AUDIT] Date ${activeDate} schedule deleted by admin.`);
      await onDeleteDate(activeDate);
    } 
    // 3. Single Slot Deletion
    else if (slotToDelete) {
      console.log(`[AUDIT] Slot ${slotToDelete.id} deleted by admin.`);
      await onDeleteSlot(slotToDelete.id);
    }
  };

  const formatDateLabel = (dateStr: string) => {
    if (!dateStr) return "";
    const date = new Date(dateStr);
    return new Intl.DateTimeFormat("en-US", { 
      month: "short", 
      day: "numeric", 
      weekday: "short" 
    }).format(date);
  };

  if (!selectedEvent) {
    return (
      <div className="flex flex-col items-center justify-center h-[50vh] text-center p-8 space-y-4">
        <div className="bg-destructive/10 p-4 rounded-full text-destructive">
          <AlertTriangle className="h-8 w-8" />
        </div>
        <h3 className="text-lg font-semibold">No Event Selected</h3>
        <p className="text-muted-foreground max-w-sm">
          You must create or select an event before you can manage slots.
        </p>
      </div>
    );
  }

  // Permission Logic
  // UPDATED: Allow creation in 'draft' mode to let admins prepare the event.
  const canCreateSlots = selectedEvent.status === 'open' || selectedEvent.status === 'draft';
  const canAssignSlots = selectedEvent.status !== 'closed' && selectedEvent.status !== 'archived';

  return (
    <div className="space-y-6 relative">
      {/* Toast Notification for Sync */}
      {isSyncing && (
        <div className="fixed bottom-4 right-4 z-50 bg-foreground text-background px-4 py-2 rounded-md shadow-lg flex items-center gap-3 animate-in slide-in-from-bottom-2">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="text-sm font-medium">{syncMessage}</span>
        </div>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground">Slots Management</h2>
          <p className="text-muted-foreground">Manage time slots for <strong>{selectedEvent.name}</strong>.</p>
        </div>
        
        <div className="flex items-center gap-2">
          <div className="hidden md:flex items-center gap-2 px-3 py-1 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 rounded-full text-xs font-medium border border-green-200 dark:border-green-800 mr-2">
             <FileSpreadsheet className="h-3 w-3" />
             Google Sheets Connected
          </div>
          
          <div className="flex flex-col items-end">
            <Button 
                onClick={() => setIsCreateModalOpen(true)}
                disabled={!canCreateSlots}
                title={!canCreateSlots ? "Cannot create slots in current status" : "Add new slots"}
            >
                <Plus className="mr-2 h-4 w-4" />
                Create Slots
            </Button>
            {!canCreateSlots && (
                <span className="text-[10px] text-destructive mt-1 font-medium">Event is {selectedEvent.status}</span>
            )}
            {selectedEvent.status === 'draft' && (
                <span className="text-[10px] text-yellow-600 dark:text-yellow-400 mt-1 font-medium">Draft Mode Active</span>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center space-x-2 border-b pb-4 overflow-x-auto">
        {availableDates.length > 0 ? (
          availableDates.map(date => (
            <Button 
              key={date}
              variant={activeDate === date ? "default" : "outline"} 
              onClick={() => setActiveDate(date)}
              className="min-w-[120px]"
            >
              {formatDateLabel(date)}
            </Button>
          ))
        ) : (
          <div className="text-sm text-muted-foreground py-2 italic flex items-center gap-2">
             <CalendarDays className="h-4 w-4" />
             No slots created yet for this event.
          </div>
        )}
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <CardTitle>
                {activeDate ? formatDateLabel(activeDate) : "Schedule"}
              </CardTitle>
              <CardDescription>
                {currentSlots.length} slots found for this date.
              </CardDescription>
            </div>
            {currentSlots.length > 0 && canCreateSlots && (
              <Button 
                variant="ghost" 
                size="sm" 
                className="text-muted-foreground hover:text-destructive text-xs h-8"
                onClick={initiateDeleteDate}
              >
                <Eraser className="mr-2 h-3 w-3" />
                Clear Schedule
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-1">
            {currentSlots.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground">
                No slots available. <br/>
                {canCreateSlots ? (
                    <Button variant="link" onClick={() => setIsCreateModalOpen(true)} className="mt-2">
                    Create slots for this date
                    </Button>
                ) : (
                    <span className="text-sm mt-2 block">Ensure event is 'Open' or 'Draft' to create slots.</span>
                )}
              </div>
            ) : (
              currentSlots.map((slot) => {
                const assignedUser = users.find(u => u.id === slot.userId);
                return (
                  <div 
                    key={slot.id} 
                    className="flex flex-col sm:flex-row sm:items-center justify-between p-4 border rounded-lg hover:bg-accent/50 transition-colors gap-4"
                  >
                    <div className="flex items-start sm:items-center gap-4">
                      <div className="flex flex-col items-center justify-center h-12 w-12 rounded bg-muted text-muted-foreground">
                        <Clock className="h-5 w-5" />
                      </div>
                      <div className="space-y-1">
                        <div className="font-semibold flex items-center gap-2 text-foreground">
                          {formatTime(slot.startTime)} - {formatTime(slot.endTime)}
                          {getStatusBadge(slot.status)}
                          
                          {/* Traceability Icon */}
                          {slot.assignmentType === 'manual' && (
                            <div className="ml-1" title={`Manually assigned by ${slot.assignedByAdminId || 'Admin'}`}>
                              <UserCog className="h-4 w-4 text-purple-500" />
                            </div>
                          )}
                        </div>
                        <div className="text-sm text-muted-foreground flex items-center gap-2">
                          <span>{getCategoryName(slot.categoryId)}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between sm:justify-end gap-2 w-full sm:w-auto">
                      {assignedUser ? (
                        <div className="flex items-center gap-2 text-sm font-medium text-foreground mr-2">
                          <UserIcon className="h-4 w-4 text-muted-foreground" />
                          {formatUser(assignedUser)}
                        </div>
                      ) : (
                        <span className="text-sm text-muted-foreground italic mr-2">Unassigned</span>
                      )}
                      
                      {canAssignSlots ? (
                        <Button 
                            size="sm" 
                            variant={assignedUser ? "outline" : "default"}
                            onClick={() => handleAssignClick(slot)}
                        >
                            {assignedUser ? "Reassign" : "Assign"}
                        </Button>
                      ) : (
                        <Button size="sm" variant="outline" disabled className="opacity-50">
                            <Lock className="h-3 w-3 mr-1" /> Locked
                        </Button>
                      )}

                      {canCreateSlots && (
                        <Button
                            variant="ghost"
                            size="icon"
                            className="text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                            onClick={() => initiateDeleteSlot(slot)}
                            title="Delete Slot"
                        >
                            <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </CardContent>
      </Card>

      <AssignSlotModal
        isOpen={isAssignModalOpen}
        onClose={() => setIsAssignModalOpen(false)}
        onConfirm={handleAssignConfirm}
        slot={selectedSlot}
        users={users}
        categories={categories}
      />

      <CreateSlotModal 
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onConfirm={handleCreateConfirm}
        defaultDate={selectedEvent.eventStartDate.toDate().toISOString().split('T')[0]} // Pass event start date
        categories={categories}
      />

      <DeleteConfirmationModal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        onConfirm={handleConfirmDelete}
        isDeletingDay={isDeletingDate}
        title={isDeletingDate ? "Clear Entire Schedule?" : "Delete Slot?"}
        description={
          isDeletingDate ? (
            <div className="flex flex-col gap-2">
               <span>
                 Are you sure you want to delete <strong>all {currentSlots.length} slots</strong> for {formatDateLabel(activeDate)}? 
               </span>
               <div className="flex items-center gap-2 p-2 bg-yellow-50 dark:bg-yellow-900/20 text-yellow-800 dark:text-yellow-200 text-xs rounded border border-yellow-200 dark:border-yellow-800">
                  <ShieldAlert className="h-4 w-4 shrink-0" />
                  Contains protection: Paid slots cannot be deleted.
               </div>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
               <span>
                 Are you sure you want to delete the <strong>{getCategoryName(slotToDelete?.categoryId || "")}</strong> slot at <strong>{formatTime(slotToDelete?.startTime!)}</strong>?
               </span>
               {slotToDelete?.status === 'paid' && (
                 <div className="flex items-center gap-2 p-2 bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-200 text-xs rounded border border-red-200 dark:border-red-800 font-bold">
                    <ShieldAlert className="h-4 w-4 shrink-0" />
                    DELETION BLOCKED: This slot is PAID.
                 </div>
               )}
            </div>
          )
        }
      />
    </div>
  );
}
