// app/[lang]/dashboard/world-pizza-trophy-admin/lib/useFirebase.ts

"use client";

import { useState, useEffect } from 'react';
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  addDoc, 
  updateDoc, 
  deleteDoc,
  doc,
  getDocs,
  Timestamp
} from 'firebase/firestore';
import { db } from '@/lib/firebase/client';
import { WPTEvent, User, Slot, Category, Product, Voucher, Payment } from '@/types/firestore';

// ============================================================================
// CONVERSION HELPERS (Firestore Timestamp ↔ Date)
// ============================================================================

/**
 * Convert Firestore Timestamp to JavaScript Date.
 * Safely handles Date, Timestamp, and null values.
 */
function convertTimestampToDate(value: any): Date | null {
  if (value === null || value === undefined) {
    return null;
  }
  if (value instanceof Date) {
    return value;
  }
  if (value && typeof value.toDate === 'function') {
    // Firestore Timestamp
    return value.toDate();
  }
  return null;
}

/**
 * Convert JavaScript Date to Firestore Timestamp.
 * Used when writing back to Firestore.
 */
function convertDateToTimestamp(value: Date | null): Timestamp | null {
  if (value === null) {
    return null;
  }
  return Timestamp.fromDate(value);
}

/**
 * Remove undefined values from an object.
 * Firestore doesn't allow undefined values in documents.
 */
function removeUndefinedValues(obj: Record<string, any>): Record<string, any> {
  const cleaned: Record<string, any> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined) {
      cleaned[key] = value;
    }
  }
  return cleaned;
}

/**
 * Recursively convert Firestore document data to domain types.
 * Handles Timestamp fields by converting them to Date.
 */
function convertFirestoreDocumentData<T extends Record<string, any>>(
  doc: T,
  timestampFields: (keyof T)[]
): T {
  const converted = { ...doc };
  
  for (const field of timestampFields) {
    if (field in converted) {
      const value = converted[field];
      converted[field] = convertTimestampToDate(value) as any;
    }
  }
  
  return converted;
}

// ============================================================================
// CATEGORY TEMPLATES HOOK (Global, Read-Only)
// ============================================================================

export const useCategoryTemplates = () => {
  const [templates, setTemplates] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    const q = query(collection(db, 'categoryTemplates'));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const data = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as Category[];
        setTemplates(data);
        setLoading(false);
      },
      (err) => {
        setError(err.message);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  return { templates, loading, error };
};

// ============================================================================
// PRODUCT TEMPLATES HOOK (Global, Read-Only)
// ============================================================================

export const useProductTemplates = () => {
  const [templates, setTemplates] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    const q = query(collection(db, 'productTemplates'));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const data = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as Product[];
        setTemplates(data);
        setLoading(false);
      },
      (err) => {
        setError(err.message);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  return { templates, loading, error };
};

// ============================================================================
// EVENTS HOOK
// ============================================================================

export const useEvents = () => {
  const [events, setEvents] = useState<WPTEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    const unsubscribe = onSnapshot(
      collection(db, 'events'),
      (snapshot) => {
        const data = snapshot.docs.map(doc => {
          const raw = doc.data();
          return convertFirestoreDocumentData(
            { id: doc.id, ...raw } as WPTEvent,
            ['eventStartDate', 'eventEndDate', 'registrationDeadline']
          );
        });
        setEvents(data);
        setLoading(false);
      },
      (err) => {
        setError(err.message);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  const createEvent = async (eventData: Omit<WPTEvent, 'id'>) => {
    try {
      const dataToWrite = removeUndefinedValues({
        name: eventData.name,
        eventYear: eventData.eventYear,
        eventStartDate: convertDateToTimestamp(eventData.eventStartDate),
        eventEndDate: convertDateToTimestamp(eventData.eventEndDate),
        registrationDeadline: convertDateToTimestamp(eventData.registrationDeadline),
        status: eventData.status,
      });
      const docRef = await addDoc(collection(db, 'events'), dataToWrite);
      return docRef.id;
    } catch (err) {
      throw new Error(`Failed to create event: ${err}`);
    }
  };

  const updateEvent = async (eventId: string, data: Partial<WPTEvent>) => {
    try {
      const dataToWrite = removeUndefinedValues({
        eventStartDate: data.eventStartDate ? convertDateToTimestamp(data.eventStartDate) : undefined,
        eventEndDate: data.eventEndDate ? convertDateToTimestamp(data.eventEndDate) : undefined,
        registrationDeadline: data.registrationDeadline ? convertDateToTimestamp(data.registrationDeadline) : undefined,
        name: data.name,
        eventYear: data.eventYear,
        status: data.status,
      });
      
      await updateDoc(doc(db, 'events', eventId), dataToWrite);
    } catch (err) {
      throw new Error(`Failed to update event: ${err}`);
    }
  };

  return { events, loading, error, createEvent, updateEvent };
};

// ============================================================================
// USERS HOOK
// ============================================================================

export const useUsers = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    const unsubscribe = onSnapshot(
      collection(db, 'users'),
      (snapshot) => {
        const data = snapshot.docs.map(doc => {
          const raw = doc.data();
          const converted = convertFirestoreDocumentData(
            { id: doc.id, ...raw } as User,
            ['createdAt']
          );
          
          // Also convert timestamps in registrations (nested objects)
          if (converted.registrations) {
            const registrations: Record<string, any> = {};
            for (const [key, reg] of Object.entries(converted.registrations)) {
              registrations[key] = {
                ...reg,
                registeredAt: convertTimestampToDate(reg.registeredAt)
              };
            }
            converted.registrations = registrations;
          }
          
          return converted;
        });
        setUsers(data);
        setLoading(false);
      },
      (err) => {
        setError(err.message);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  const updateUser = async (userId: string, data: Partial<User>) => {
    try {
      const dataToWrite = removeUndefinedValues({
        createdAt: data.createdAt ? convertDateToTimestamp(data.createdAt) : undefined,
        firstName: data.firstName,
        lastName: data.lastName,
        email: data.email,
        country: data.country,
        phone: data.phone,
        role: data.role,
        registrations: data.registrations
          ? Object.fromEntries(
              Object.entries(data.registrations).map(([key, reg]) => [
                key,
                {
                  ...reg,
                  registeredAt: convertDateToTimestamp(reg.registeredAt)
                }
              ])
            )
          : undefined,
      });
      
      await updateDoc(doc(db, 'users', userId), dataToWrite);
    } catch (err) {
      throw new Error(`Failed to update user: ${err}`);
    }
  };

  return { users, loading, error, updateUser };
};

// ============================================================================
// SLOTS HOOK
// ============================================================================

export const useSlots = (eventId?: string) => {
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!eventId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    const q = query(collection(db, 'slots'), where('eventId', '==', eventId));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const data = snapshot.docs.map(doc => {
          const raw = doc.data();
          return convertFirestoreDocumentData(
            { id: doc.id, ...raw } as Slot,
            ['startTime', 'endTime', 'assignedAt']
          );
        });
        setSlots(data);
        setLoading(false);
      },
      (err) => {
        setError(err.message);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [eventId]);

  const createSlots = async (slotsData: Omit<Slot, 'id'>[]) => {
    try {
      const promises = slotsData.map(slot => {
        const dataToWrite = removeUndefinedValues({
          ...slot,
          startTime: convertDateToTimestamp(slot.startTime),
          endTime: convertDateToTimestamp(slot.endTime),
          assignedAt: slot.assignedAt ? convertDateToTimestamp(slot.assignedAt) : undefined,
        });
        return addDoc(collection(db, 'slots'), dataToWrite);
      });
      await Promise.all(promises);
    } catch (err) {
      throw new Error(`Failed to create slots: ${err}`);
    }
  };

  const updateSlot = async (slotId: string, data: Partial<Slot>) => {
    try {
      const dataToWrite = removeUndefinedValues({
        startTime: data.startTime ? convertDateToTimestamp(data.startTime) : undefined,
        endTime: data.endTime ? convertDateToTimestamp(data.endTime) : undefined,
        assignedAt: data.assignedAt ? convertDateToTimestamp(data.assignedAt) : null,
        status: data.status,
        userId: data.userId,
        stripeSessionId: data.stripeSessionId,
        assignedByAdminId: data.assignedByAdminId,
        assignmentType: data.assignmentType,
      });
      
      await updateDoc(doc(db, 'slots', slotId), dataToWrite);
    } catch (err) {
      throw new Error(`Failed to update slot: ${err}`);
    }
  };

  const deleteSlot = async (slotId: string) => {
    try {
      await deleteDoc(doc(db, 'slots', slotId));
    } catch (err) {
      throw new Error(`Failed to delete slot: ${err}`);
    }
  };

  const deleteSlotsByDate = async (date: string, eventId: string) => {
    try {
      const q = query(
        collection(db, 'slots'),
        where('date', '==', date),
        where('eventId', '==', eventId)
      );
      const snapshot = await getDocs(q);
      const deletePromises = snapshot.docs.map(doc => deleteDoc(doc.ref));
      await Promise.all(deletePromises);
    } catch (err) {
      throw new Error(`Failed to delete slots by date: ${err}`);
    }
  };

  return { slots, loading, error, createSlots, updateSlot, deleteSlot, deleteSlotsByDate };
};

// ============================================================================
// CATEGORIES HOOK (Event-specific, Fully editable)
// ============================================================================

export const useCategories = (eventId?: string) => {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!eventId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    const q = query(
      collection(db, 'categories'),
      where('eventId', '==', eventId)
    );
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const data = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as Category[];
        setCategories(data);
        setLoading(false);
      },
      (err) => {
        setError(err.message);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [eventId]);

  const createCategory = async (catData: Omit<Category, 'id'>) => {
    if (!catData.eventId) {
      throw new Error('Category must have an eventId');
    }
    try {
      const docRef = await addDoc(collection(db, 'categories'), catData);
      return docRef.id;
    } catch (err) {
      throw new Error(`Failed to create category: ${err}`);
    }
  };

  const updateCategory = async (catId: string, data: Partial<Category>) => {
    try {
      const categoryRef = doc(db, 'categories', catId);
      const snapshot = await getDocs(query(collection(db, 'categories'), where('__name__', '==', catId)));
      if (snapshot.empty) {
        throw new Error(`Category with ID "${catId}" not found in database`);
      }
      await updateDoc(categoryRef, data);
    } catch (err) {
      throw new Error(`Failed to update category: ${err}`);
    }
  };

  const deleteCategory = async (catId: string) => {
    try {
      const categoryRef = doc(db, 'categories', catId);
      const snapshot = await getDocs(query(collection(db, 'categories'), where('__name__', '==', catId)));
      if (snapshot.empty) {
        throw new Error(`Category with ID "${catId}" not found in database`);
      }
      await deleteDoc(categoryRef);
    } catch (err) {
      throw new Error(`Failed to delete category: ${err}`);
    }
  };

  return { categories, loading, error, createCategory, updateCategory, deleteCategory };
};

// ============================================================================
// PRODUCTS HOOK (Event-specific, Fully editable)
// ============================================================================

export const useProducts = (eventId?: string) => {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!eventId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    const q = query(
      collection(db, 'products'),
      where('eventId', '==', eventId)
    );
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const data = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as Product[];
        setProducts(data);
        setLoading(false);
      },
      (err) => {
        setError(err.message);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [eventId]);

  const createProduct = async (productData: Omit<Product, 'id'>) => {
    if (!productData.eventId) {
      throw new Error('Product must have an eventId');
    }
    try {
      const docRef = await addDoc(collection(db, 'products'), productData);
      return docRef.id;
    } catch (err) {
      throw new Error(`Failed to create product: ${err}`);
    }
  };

  const updateProduct = async (productId: string, data: Partial<Product>) => {
    try {
      const productRef = doc(db, 'products', productId);
      const snapshot = await getDocs(query(collection(db, 'products'), where('__name__', '==', productId)));
      if (snapshot.empty) {
        throw new Error(`Product with ID "${productId}" not found in database`);
      }
      await updateDoc(productRef, data);
    } catch (err) {
      throw new Error(`Failed to update product: ${err}`);
    }
  };

  const deleteProduct = async (productId: string) => {
    try {
      const productRef = doc(db, 'products', productId);
      const snapshot = await getDocs(query(collection(db, 'products'), where('__name__', '==', productId)));
      if (snapshot.empty) {
        throw new Error(`Product with ID "${productId}" not found in database`);
      }
      await deleteDoc(productRef);
    } catch (err) {
      throw new Error(`Failed to delete product: ${err}`);
    }
  };

  return { products, loading, error, createProduct, updateProduct, deleteProduct };
};

// ============================================================================
// VOUCHERS HOOK
// ============================================================================

export const useVouchers = (eventId?: string) => {
  const [vouchers, setVouchers] = useState<Voucher[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!eventId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    const q = query(collection(db, 'vouchers'), where('eventId', '==', eventId));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const data = snapshot.docs.map(doc => {
          const raw = doc.data();
          return convertFirestoreDocumentData(
            { id: doc.id, ...raw } as Voucher,
            ['expiresAt', 'createdAt']
          );
        });
        setVouchers(data);
        setLoading(false);
      },
      (err) => {
        setError(err.message);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [eventId]);

  const createVoucher = async (voucherData: Omit<Voucher, 'id'>) => {
    try {
      const dataToWrite = removeUndefinedValues({
        ...voucherData,
        expiresAt: voucherData.expiresAt ? convertDateToTimestamp(voucherData.expiresAt) : null,
        createdAt: convertDateToTimestamp(voucherData.createdAt),
      });
      const docRef = await addDoc(collection(db, 'vouchers'), dataToWrite);
      return docRef.id;
    } catch (err) {
      throw new Error(`Failed to create voucher: ${err}`);
    }
  };

  const deleteVoucher = async (voucherId: string) => {
    try {
      await deleteDoc(doc(db, 'vouchers', voucherId));
    } catch (err) {
      throw new Error(`Failed to delete voucher: ${err}`);
    }
  };

  return { vouchers, loading, error, createVoucher, deleteVoucher };
};

// ============================================================================
// PAYMENTS HOOK
// ============================================================================

export const usePayments = (eventId?: string) => {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!eventId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    const q = query(collection(db, 'payments'), where('eventId', '==', eventId));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const data = snapshot.docs.map(doc => {
          const raw = doc.data();
          return convertFirestoreDocumentData(
            { id: doc.id, ...raw } as Payment,
            ['createdAt', 'updatedAt']
          );
        });
        setPayments(data);
        setLoading(false);
      },
      (err) => {
        setError(err.message);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [eventId]);

  const updatePayment = async (paymentId: string, data: Partial<Payment>) => {
    try {
      const dataToWrite = removeUndefinedValues({
        createdAt: data.createdAt ? convertDateToTimestamp(data.createdAt) : undefined,
        updatedAt: data.updatedAt ? convertDateToTimestamp(data.updatedAt) : undefined,
        status: data.status,
        metadata: data.metadata,
        slotIds: data.slotIds,
      });
      
      await updateDoc(doc(db, 'payments', paymentId), dataToWrite);
    } catch (err) {
      throw new Error(`Failed to update payment: ${err}`);
    }
  };

  return { payments, loading, error, updatePayment };
};
