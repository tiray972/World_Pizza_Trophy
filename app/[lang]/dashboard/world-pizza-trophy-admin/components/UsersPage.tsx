"use client";
import React, { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/Card";
import { Button } from "./ui/Button";
import { Badge } from "./ui/Badge";
import { Slot, User, Category, WPTEvent } from "@/types/firestore"; // Import WPTEvent to check status
import { ManualSlotAssignModal } from "./ManualSlotAssignModal";
import { Plus, Search, Calendar, CheckCircle2, XCircle, Loader2, FileSpreadsheet, Globe, AlertTriangle, UserMinus, Lock } from "lucide-react";
import { formatUser } from "../lib/utils";
import { Timestamp } from "firebase/firestore";

interface UsersPageProps {
  users: User[];
  slots: Slot[];
  categories: Category[];
  selectedEventId: string;
  onUpdateSlots: (slots: Slot[]) => void;
  // We need to look up event status, but currently we only receive ID.
  // Ideally, we should pass the full event object, or a 'canAssign' boolean.
  // Since we don't want to refactor App.tsx's generic props too much, we will accept an optional status prop
  // OR just assume App.tsx passes the event object.
  // Let's modify App.tsx to pass the full selectedEvent to UsersPage or check logic there.
  // For cleanliness, let's update UsersPageProps to accept the event object if possible, 
  // but looking at App.tsx, it's easier to pass 'isAssignmentLocked' as a prop.
  isAssignmentLocked?: boolean; 
}

export function UsersPage({ users, slots, categories, selectedEventId, onUpdateSlots, isAssignmentLocked = false }: UsersPageProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [isSyncing, setIsSyncing] = useState(false);

  const handleAssignClick = (user: User) => {
    setSelectedUser(user);
    setIsModalOpen(true);
  };

  const handleAssignConfirm = async (userId: string, slotIds: string[]) => {
    setIsSyncing(true);
    await new Promise(resolve => setTimeout(resolve, 1500));

    const user = users.find(u => u.id === userId);
    // Determine paid status for this specific event
    const isPaid = user?.registrations[selectedEventId]?.paid || false;

    const updatedSlots: Slot[] = [];
    
    slots.forEach(slot => {
      if (slotIds.includes(slot.id)) {
        // Log action
        console.log(`[AUDIT] Slot ${slot.id} batch assigned to ${userId} by admin.`);
        
        updatedSlots.push({
          ...slot,
          userId: user?.id,
          status: isPaid ? 'paid' : 'offered',
          // Traceability
          assignedByAdminId: 'admin_current',
          assignedAt: Timestamp.now(),
          assignmentType: 'manual'
        });
      }
    });

    onUpdateSlots(updatedSlots);
    setIsSyncing(false);
  };

  const getAssignedSlotCount = (userId: string) => {
    return slots.filter(s => s.userId === userId).length;
  };

  const filteredUsers = users.filter(user => {
    const searchLower = searchQuery.toLowerCase();
    return (
      user.firstName.toLowerCase().includes(searchLower) || 
      user.lastName.toLowerCase().includes(searchLower) ||
      user.email.toLowerCase().includes(searchLower)
    );
  });

  if (!selectedEventId) {
    return (
      <div className="flex flex-col items-center justify-center h-[50vh] text-center p-8 space-y-4">
        <div className="bg-destructive/10 p-4 rounded-full text-destructive">
          <AlertTriangle className="h-8 w-8" />
        </div>
        <h3 className="text-lg font-semibold">No Event Selected</h3>
        <p className="text-muted-foreground max-w-sm">
          Select an event to see registered competitors and their status.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 relative">
      {isSyncing && (
        <div className="fixed bottom-4 right-4 z-50 bg-green-600 text-white px-4 py-2 rounded-md shadow-lg flex items-center gap-3 animate-in slide-in-from-bottom-2">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="text-sm font-medium">Syncing assignments...</span>
        </div>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground">Competitors</h2>
          <p className="text-muted-foreground">Manage users and their status for the current event.</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
             <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
             <input
                type="text"
                placeholder="Search..."
                className="flex h-10 w-full rounded-md border border-input bg-background text-foreground pl-9 pr-3 py-2 text-sm w-[250px]"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
          </div>
          <Button disabled={isAssignmentLocked}>
            <Plus className="mr-2 h-4 w-4" />
            Add User
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle>Registered Competitors</CardTitle>
            <div className="hidden md:flex items-center gap-2 text-xs text-muted-foreground">
               <FileSpreadsheet className="h-3 w-3" />
               Auto-sync enabled
            </div>
          </div>
          <CardDescription>
            {filteredUsers.length} users found in database.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="relative w-full overflow-auto">
            <table className="w-full caption-bottom text-sm text-left text-foreground">
              <thead className="[&_tr]:border-b">
                <tr className="border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted">
                  <th className="h-12 px-4 align-middle font-medium text-muted-foreground">Name</th>
                  <th className="h-12 px-4 align-middle font-medium text-muted-foreground">Role</th>
                  <th className="h-12 px-4 align-middle font-medium text-muted-foreground">Event Status</th>
                  <th className="h-12 px-4 align-middle font-medium text-muted-foreground">Slots</th>
                  <th className="h-12 px-4 align-middle font-medium text-muted-foreground text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="[&_tr:last-child]:border-0 text-foreground">
                {filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-4 text-center text-muted-foreground">
                      No users found.
                    </td>
                  </tr>
                ) : (
                  filteredUsers.map((user) => {
                    const slotCount = getAssignedSlotCount(user.id);
                    const registration = user.registrations[selectedEventId];
                    const isRegistered = !!registration;
                    const isPaid = registration?.paid;

                    return (
                      <tr key={user.id} className="border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted">
                        <td className="p-4 align-middle font-medium text-foreground">
                           <div className="flex flex-col">
                             <span>{formatUser(user)}</span>
                             <span className="text-xs text-muted-foreground">{user.email}</span>
                             <span className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                               <Globe className="h-3 w-3" /> {user.country}
                             </span>
                           </div>
                        </td>
                        <td className="p-4 align-middle text-foreground capitalize">
                          {user.role}
                        </td>
                        <td className="p-4 align-middle">
                          <div className="flex items-center gap-2">
                             {!isRegistered ? (
                               <Badge variant="outline" className="text-muted-foreground gap-1">
                                  <UserMinus className="h-3 w-3" /> Not Registered
                               </Badge>
                             ) : isPaid ? (
                               <Badge variant="success" className="gap-1">
                                 <CheckCircle2 className="h-3 w-3" /> Paid
                               </Badge>
                             ) : (
                               <Badge variant="destructive" className="gap-1">
                                 <XCircle className="h-3 w-3" /> Unpaid
                               </Badge>
                             )}
                          </div>
                        </td>
                        <td className="p-4 align-middle">
                          <Badge variant="secondary" className="gap-1">
                             <Calendar className="h-3 w-3" />
                             {slotCount} Assigned
                          </Badge>
                        </td>
                        <td className="p-4 align-middle text-right">
                          {isAssignmentLocked ? (
                            <Button variant="ghost" size="sm" disabled className="text-muted-foreground">
                                <Lock className="h-3 w-3 mr-1" /> Locked
                            </Button>
                          ) : (
                            <Button 
                                variant="outline" 
                                size="sm"
                                onClick={() => handleAssignClick(user)}
                                disabled={!isRegistered}
                            >
                                Assign Slots
                            </Button>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <ManualSlotAssignModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onConfirm={handleAssignConfirm}
        user={selectedUser}
        slots={slots}
        categories={categories}
      />
    </div>
  );
}
