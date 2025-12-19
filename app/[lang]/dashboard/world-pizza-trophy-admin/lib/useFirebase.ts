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

// --- CATEGORY TEMPLATES HOOK (Global, Read-Only) ---
export const useCategoryTemplates = () => {
  const [templates, setTemplates] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    // Query templates collection (no eventId filter = global templates)
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

// --- PRODUCT TEMPLATES HOOK (Global, Read-Only) ---
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

// --- EVENTS HOOK ---
export const useEvents = () => {
  const [events, setEvents] = useState<WPTEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    const unsubscribe = onSnapshot(
      collection(db, 'events'),
      (snapshot) => {
        const data = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as WPTEvent[];
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
      const docRef = await addDoc(collection(db, 'events'), eventData);
      return docRef.id;
    } catch (err) {
      throw new Error(`Failed to create event: ${err}`);
    }
  };

  const updateEvent = async (eventId: string, data: Partial<WPTEvent>) => {
    try {
      await updateDoc(doc(db, 'events', eventId), data);
    } catch (err) {
      throw new Error(`Failed to update event: ${err}`);
    }
  };

  return { events, loading, error, createEvent, updateEvent };
};

// --- USERS HOOK ---
export const useUsers = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    const unsubscribe = onSnapshot(
      collection(db, 'users'),
      (snapshot) => {
        const data = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as User[];
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
      await updateDoc(doc(db, 'users', userId), data);
    } catch (err) {
      throw new Error(`Failed to update user: ${err}`);
    }
  };

  return { users, loading, error, updateUser };
};

// --- SLOTS HOOK ---
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
        const data = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as Slot[];
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
      const promises = slotsData.map(slot => addDoc(collection(db, 'slots'), slot));
      await Promise.all(promises);
    } catch (err) {
      throw new Error(`Failed to create slots: ${err}`);
    }
  };

  const updateSlot = async (slotId: string, data: Partial<Slot>) => {
    try {
      await updateDoc(doc(db, 'slots', slotId), data);
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

// --- CATEGORIES HOOK (Event-specific, Fully editable) ---
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
    // Query only categories WITH eventId (not templates)
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
    // Guard: Must have eventId
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
      // Verify document exists before updating
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
      // Verify document exists before deleting
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

// --- PRODUCTS HOOK (Event-specific, Fully editable) ---
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
    // Query only products WITH eventId (not templates)
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
    // Guard: Must have eventId
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
      // Verify document exists before updating
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
      // Verify document exists before deleting
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

// --- VOUCHERS HOOK ---
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
        const data = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as Voucher[];
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
      const docRef = await addDoc(collection(db, 'vouchers'), voucherData);
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

// --- PAYMENTS HOOK ---
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
        const data = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as Payment[];
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
      await updateDoc(doc(db, 'payments', paymentId), data);
    } catch (err) {
      throw new Error(`Failed to update payment: ${err}`);
    }
  };

  return { payments, loading, error, updatePayment };
};
