# 👥 Participant Management Guide - WPT Admin Dashboard

## Overview

The World Pizza Trophy admin dashboard now fully supports **participant management**. This allows admins to track not just who paid for slots (the "buyer"), but also WHO will actually compete (the "participant").

### Key Concept: Buyer vs Participant

- **Buyer** (`buyerId`): The user who registered and paid for a slot
- **Participant** (`participant`): The person who will actually compete (can be different from the buyer)

This separation is crucial for:
- Corporate team registrations (company pays, employees compete)
- Delegated bookings (friend pays for you)
- Team events where one person manages registrations

---

## 📋 Implementation Details

### Type Definition (types/firestore.ts)

```typescript
export interface Participant {
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
}

export interface Slot {
  id: string;
  eventId: string;
  categoryId: string;
  date: string;
  startTime: Date;
  endTime: Date;
  status: SlotStatus;
  
  buyerId: string;              // Who paid for this slot
  participant?: Participant;    // Who will actually compete
  
  // ...other fields...
}
```

---

## �� Features by Page

### 1. **SlotsPage** - Schedule Management

**What's New:**
- ✅ Displays participant info directly in slot cards
- ✅ Shows visual indicator when participant info is attached
- ✅ Color-coded backgrounds:
  - 🟢 Green = Slot has participant info
  - 🟡 Yellow = Slot assigned but no participant yet

**How to Use:**
1. Click "Assign" or "Reassign" on a slot
2. Modal opens showing:
   - Buyer selection dropdown
   - Current participant info (if exists)
   - Toggle: "Add/Edit Participant Info"
3. Fill in participant details:
   - First Name (required)
   - Last Name (required)
   - Email (optional)
   - Phone (optional)
4. Click "Assign Slot"

**Audit Trail:**
```
[AUDIT] Slot {slotId} manually assigned to User {userId} 
        with participant {firstName} {lastName} by admin.
```

---

### 2. **UsersPage** - Competitor Management

**What's New:**
- ✅ Shows all assigned slots per user
- ✅ Batch assignment with participant info
- ✅ Search functionality for finding competitors

**How to Use:**
1. Select a user from the table
2. Click "Assign Slots"
3. Modal shows all available slots:
   - Toggle "Add Participant Info for Each Slot"
   - Select multiple slots
   - If toggled, enter participant details for EACH selected slot
   - Click "Assign X Slots"

**Key Validation:**
- Only registered users can be assigned slots
- Status (Paid/Unpaid) shown in red/green badge
- Batch operations are atomic (all or nothing)

---

### 3. **PaymentsPage** - Financial Reconciliation

**What's New:**
- ✅ NEW Column: "Participants"
- ✅ Shows all participant names for each payment
- ✅ Email column shows participant contact info
- ✅ Sync health checks for participant completeness

**Display Features:**
- Lists all participants associated with payment's slots
- Shows 👤 emoji with participant name
- Displays participant email if available
- Flags "No participants" slots in yellow

**Financial Tracking:**
- Identifies mismatches between buyer and participants
- Ensures payment records include participant info
- Helps with compliance and reporting

---

### 4. **ExportsPage** - Data Export & Sync

**What's New:**
- ✅ Google Sheets preview now includes participant columns
- ✅ Columns F-H in preview show:
  - **F (Buyer)**: User ID who paid
  - **G (Participant)**: Full name of competitor
  - **H (Email)**: Participant contact email
- ✅ CSV exports include all participant data
- ✅ Live sync to Google Sheets with participant info

**Export Columns:**
```
Date | Start | End | Category | Status | Buyer ID | Participant Name | Email | Phone
```

**Use Cases:**
- Generate competition rosters with actual competitor names
- Export for live streaming overlays
- Compliance reports with real competitor info
- Communication templates using participant email

---

## 🔄 Data Flow

```
User Registration
    ↓
Payment Processed → Slot Reserved → Buyer ID = User ID
    ↓
Admin Assigns Participant Details
    ↓
Slot Updated with:
  - buyerId (unchanged)
  - participant { firstName, lastName, email, phone }
    ↓
Exports & Payments reflect participant info
    ↓
Competition Day: Use participant name on leaderboard
```

---

## ✅ Validation & Error Handling

### Participant Info
- **First Name**: Required if adding participant
- **Last Name**: Required if adding participant
- **Email**: Optional but recommended
- **Phone**: Optional

### Slot Assignment
- Buyer must exist in system
- Cannot assign unpaid users to paid slots
- Participant info is optional (slots can be assigned without it)
- Batch assignments are atomic

### Data Integrity
- `buyerId` is always set when slot is assigned
- `participant` can be null (slot still valid)
- Participant info is immutable after assignment (must reassign to change)

---

## 🔐 Audit Trail

All participant assignments are logged:

```typescript
// SlotsPage Assignment
console.log(`[AUDIT] Slot ${slotId} manually assigned to User ${userId} 
            with participant ${participant?.firstName} ${participant?.lastName} by admin.`);

// Batch Assignment (UsersPage)
console.log(`[AUDIT] Slot ${slotId} batch assigned to ${userId} by admin.`);
```

---

## 🎨 UI/UX Patterns

### Visual Indicators

**Participant Attached:**
```
✅ Green checkmark icon
🟢 Green background tint
👤 Participant name display
```

**No Participant:**
```
⚠️ Yellow warning tint
✋ "No participants" text
```

**Manual Assignment:**
```
🔧 Purple UserCog icon
```

### Form States

**AssignSlotModal:**
- Shows buyer selection
- Shows current participant (if exists)
- Toggle to add/edit participant
- Multi-field form with validation

**ManualSlotAssignModal:**
- Checkbox-based slot selection
- Expandable participant form per slot
- Inline validation
- Batch submit

---

## 📊 Reporting & Analytics

### Key Metrics

1. **Completion Rate**: % of slots with participant info
2. **Buyer vs Participant Mismatch**: Cases where different people
3. **Payment to Participant Sync**: Validation checks

### Export Use Cases

1. **Competition Day Checklist**: Print with participant names
2. **Live Streaming**: Use participant name on overlay
3. **Scoreboard**: Leaderboard with actual competitor names
4. **Email Communications**: Send to participant email, not buyer
5. **Compliance Reports**: Verify all participants are registered

---

## 🚀 Future Enhancements

- [ ] Bulk CSV import of participant data
- [ ] Participant self-registration portal
- [ ] Team management (multiple participants per buyer)
- [ ] Participant profile photos
- [ ] QR code check-in at competition
- [ ] Participant email notifications
- [ ] Participant contract signatures

---

## 🛠️ Technical Notes

### Files Modified

1. **types/firestore.ts** - Added `Participant` interface
2. **components/SlotsPage.tsx** - Display participant info, handle assignment
3. **components/AssignSlotModal.tsx** - Participant form input
4. **components/ManualSlotAssignModal.tsx** - Batch assignment with participants
5. **components/UsersPage.tsx** - Updated handler and UI
6. **components/PaymentsPage.tsx** - Display participant column
7. **components/ExportsPage.tsx** - Export with participant columns

### Key Functions

```typescript
// Assign slot with participant
onConfirm(userId: string, participant?: Participant)

// Batch assign slots
onConfirm(userId: string, slotIds: string[], participants?: Record<string, Participant>)

// Update slot with participant
const updatedSlot: Slot = {
  ...slot,
  buyerId: userId,
  participant: { firstName, lastName, email, phone },
  status: isPaid ? 'paid' : 'offered',
  assignedByAdminId: 'admin_current',
  assignedAt: new Date(),
  assignmentType: 'manual'
};
```

---

## ❓ FAQ

**Q: Can a participant be assigned to multiple slots?**
A: Not directly. Each slot has one participant. If a person competes in multiple categories, they'd need a separate participant entry in each slot.

**Q: What if buyer and participant are the same?**
A: That's the most common case! Just leave participant info blank or fill it with the same details.

**Q: Can I change participant after assignment?**
A: Currently, you must reassign the slot. Future enhancement could allow direct editing.

**Q: Are participant emails sent automatically?**
A: Not yet. Emails are sent to the buyer. Future enhancement will support sending to participant email.

**Q: How do I bulk import participants?**
A: Future feature. Currently manual via admin dashboard.

---

## 📞 Support

For issues or questions about participant management, refer to:
- Component code comments
- Audit logs in browser console (search for `[AUDIT]`)
- Type definitions in `types/firestore.ts`

