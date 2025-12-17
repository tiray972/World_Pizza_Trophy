import React, { useState, useMemo, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/Card";
import { Button } from "./ui/Button";
import { Badge } from "./ui/Badge";
import { Slot, User, SlotStatus } from "../types";
import { AssignSlotModal } from "./AssignSlotModal";
import { CreateSlotModal } from "./CreateSlotModal";
import { DeleteConfirmationModal } from "./DeleteConfirmationModal";
import { Clock, User as UserIcon, Loader2, FileSpreadsheet, Plus, CalendarDays, Trash2, Eraser } from "lucide-react";
import { cn } from "../lib/utils";

interface SlotsPageProps {
  slots: Slot[];
  users: User[];
  onUpdateSlot: (slot: Slot) => void;
  onCreateSlot: (slotsData: Omit<Slot, "id" | "status" | "userId" | "userFullName">[]) => Promise<void>;
  onDeleteSlot: (slotId: string) => Promise<void>;
  onDeleteDate: (date: string) => Promise<void>;
}

export function SlotsPage({ slots, users, onUpdateSlot, onCreateSlot, onDeleteSlot, onDeleteDate }: SlotsPageProps) {
  // Determine available dates from the slots
  const availableDates = useMemo(() => {
    const dates = Array.from(new Set(slots.map(s => s.date))).sort();
    return dates;
  }, [slots]);

  // Set active date to the first available date if not set, or if current selection is invalid
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
  const currentSlots = slots.filter(s => s.date === activeDate).sort((a, b) => a.startTime.localeCompare(b.startTime));

  const getStatusBadge = (status: SlotStatus) => {
    switch (status) {
      case 'available': return <Badge variant="secondary">Available</Badge>;
      case 'paid': return <Badge variant="success">Paid</Badge>;
      case 'offered': return <Badge variant="warning">Offered</Badge>;
      default: return <Badge variant="outline">{status}</Badge>;
    }
  };

  const handleAssignClick = (slot: Slot) => {
    setSelectedSlot(slot);
    setIsAssignModalOpen(true);
  };

  const handleCreateConfirm = async (slotsData: Omit<Slot, "id" | "status" | "userId" | "userFullName">[]) => {
    await onCreateSlot(slotsData);
    // Switch view to the date of the first newly created slot if available
    if (slotsData.length > 0) {
      setActiveDate(slotsData[0].date);
    }
  };

  const handleAssignConfirm = async (userId: string) => {
    setIsSyncing(true);
    setSyncMessage("Updating Database...");
    
    await new Promise(resolve => setTimeout(resolve, 600));

    const user = users.find(u => u.id === userId);
    const isPaid = user?.paid || false;
    const newStatus: SlotStatus = isPaid ? 'paid' : 'offered';

    setSyncMessage("Syncing to Google Sheets...");
    await new Promise(resolve => setTimeout(resolve, 800));

    if (selectedSlot) {
      onUpdateSlot({
        ...selectedSlot,
        userId,
        userFullName: user?.fullName,
        status: newStatus
      });
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
    if (isDeletingDate && activeDate) {
      await onDeleteDate(activeDate);
    } else if (slotToDelete) {
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
          <p className="text-muted-foreground">Manage competition time slots and assignments.</p>
        </div>
        
        <div className="flex items-center gap-2">
          <div className="hidden md:flex items-center gap-2 px-3 py-1 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 rounded-full text-xs font-medium border border-green-200 dark:border-green-800 mr-2">
             <FileSpreadsheet className="h-3 w-3" />
             Google Sheets Connected
          </div>
          
          <Button onClick={() => setIsCreateModalOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Create Slots
          </Button>
        </div>
      </div>

      {/* Dynamic Date Tabs */}
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
             No competition dates scheduled yet.
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
            {currentSlots.length > 0 && (
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
                <Button variant="link" onClick={() => setIsCreateModalOpen(true)} className="mt-2">
                  Create slots for this date
                </Button>
              </div>
            ) : (
              currentSlots.map((slot) => (
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
                        {slot.startTime} - {slot.endTime}
                        {getStatusBadge(slot.status)}
                      </div>
                      <div className="text-sm text-muted-foreground flex items-center gap-2">
                        <span>{slot.category}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-2 w-full sm:w-auto">
                    {slot.userFullName ? (
                      <div className="flex items-center gap-2 text-sm font-medium text-foreground mr-2">
                        <UserIcon className="h-4 w-4 text-muted-foreground" />
                        {slot.userFullName}
                      </div>
                    ) : (
                      <span className="text-sm text-muted-foreground italic mr-2">Unassigned</span>
                    )}
                    
                    <Button 
                      size="sm" 
                      variant={slot.userFullName ? "outline" : "default"}
                      onClick={() => handleAssignClick(slot)}
                    >
                      {slot.userFullName ? "Reassign" : "Assign"}
                    </Button>

                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                      onClick={() => initiateDeleteSlot(slot)}
                      title="Delete Slot"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))
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
      />

      <CreateSlotModal 
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onConfirm={handleCreateConfirm}
      />

      <DeleteConfirmationModal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        onConfirm={handleConfirmDelete}
        isDeletingDay={isDeletingDate}
        title={isDeletingDate ? "Clear Entire Schedule?" : "Delete Slot?"}
        description={
          isDeletingDate ? (
            <span>
              Are you sure you want to delete <strong>all {currentSlots.length} slots</strong> for {formatDateLabel(activeDate)}? 
              <br/><br/>
              This will remove all assignments for this day. This action cannot be undone.
            </span>
          ) : (
            <span>
              Are you sure you want to delete the <strong>{slotToDelete?.category}</strong> slot at <strong>{slotToDelete?.startTime}</strong>?
              <br/><br/>
              This action cannot be undone.
            </span>
          )
        }
      />
    </div>
  );
}