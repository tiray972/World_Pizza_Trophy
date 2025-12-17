import React, { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/Card";
import { Button } from "./ui/Button";
import { Badge } from "./ui/Badge";
import { Slot, User } from "../types";
import { ManualSlotAssignModal } from "./ManualSlotAssignModal";
import { Plus, Search, Calendar, CheckCircle2, XCircle, Loader2, FileSpreadsheet } from "lucide-react";
import { cn } from "../lib/utils";

interface UsersPageProps {
  users: User[];
  slots: Slot[];
  onUpdateSlots: (slots: Slot[]) => void;
}

export function UsersPage({ users, slots, onUpdateSlots }: UsersPageProps) {
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
    
    // Simulate network delay and sync
    await new Promise(resolve => setTimeout(resolve, 1500));

    // Calculate updates
    const user = users.find(u => u.id === userId);
    const updatedSlots: Slot[] = [];
    
    slots.forEach(slot => {
      if (slotIds.includes(slot.id)) {
        updatedSlots.push({
          ...slot,
          userId: user?.id,
          userFullName: user?.fullName,
          status: user?.paid ? 'paid' : 'offered'
        });
      }
    });

    onUpdateSlots(updatedSlots);
    setIsSyncing(false);
  };

  // Helper to count slots assigned to a user
  const getAssignedSlotCount = (userId: string) => {
    return slots.filter(s => s.userId === userId).length;
  };

  const filteredUsers = users.filter(user => 
    user.fullName.toLowerCase().includes(searchQuery.toLowerCase()) || 
    user.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6 relative">
      {/* Toast Notification for Sync */}
      {isSyncing && (
        <div className="fixed bottom-4 right-4 z-50 bg-green-600 text-white px-4 py-2 rounded-md shadow-lg flex items-center gap-3 animate-in slide-in-from-bottom-2">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="text-sm font-medium">Syncing assignments to Google Sheets...</span>
        </div>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground">Competitors</h2>
          <p className="text-muted-foreground">Manage users and their slot assignments.</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
             <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
             <input
                type="text"
                placeholder="Search users..."
                className="flex h-10 w-full rounded-md border border-input bg-background text-foreground pl-9 pr-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 w-[250px]"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
          </div>
          <Button>
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
            {filteredUsers.length} users found.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="relative w-full overflow-auto">
            <table className="w-full caption-bottom text-sm text-left text-foreground">
              <thead className="[&_tr]:border-b">
                <tr className="border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted">
                  <th className="h-12 px-4 align-middle font-medium text-muted-foreground">Name</th>
                  <th className="h-12 px-4 align-middle font-medium text-muted-foreground">Email</th>
                  <th className="h-12 px-4 align-middle font-medium text-muted-foreground">Payment Status</th>
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
                    return (
                      <tr key={user.id} className="border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted">
                        <td className="p-4 align-middle font-medium text-foreground">{user.fullName}</td>
                        <td className="p-4 align-middle text-foreground">{user.email}</td>
                        <td className="p-4 align-middle">
                          <div className="flex items-center gap-2">
                             {user.paid ? (
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
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => handleAssignClick(user)}
                          >
                            Assign Slots
                          </Button>
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
      />
    </div>
  );
}