
import { 
  collection, 
  addDoc, 
  getDocs, 
  updateDoc, 
  deleteDoc, 
  doc, 
  query, 
  orderBy, 
  where,
  limit,
  Timestamp,
  getDoc,
  setDoc,
  writeBatch,
  startAfter,
  QueryDocumentSnapshot,
  DocumentData,
  onSnapshot,
  Query
} from "firebase/firestore";
import { 
  ref, 
  uploadString, 
  getDownloadURL 
} from "firebase/storage";
import { db, storage } from "../firebase";
import { Employee, Expense, Task, TaskStatus, AppSettings, GeneratedImage, Plaza, Fallo } from "../types";
import { uploadToImgBB } from "./imgbbService";


// --- HELPERS ---

/**
 * Uploads a base64 string to Firebase Storage and returns the public download URL.
 * This is MUCH faster for loading than storing base64 in Firestore documents.
 */
const uploadBase64ToStorage = async (base64: string, path: string): Promise<string> => {
  try {
    // If it's already a URL, don't re-upload
    if (base64.startsWith('http')) return base64;
    
    const storageRef = ref(storage, path);
    
    // Create a timeout promise
    const timeoutPromise = new Promise<never>((_, reject) => 
      setTimeout(() => reject(new Error('Storage upload timeout')), 45000)
    );

    // uploadString handles base64 easily
    const uploadPromise = uploadString(storageRef, base64, 'data_url');
    
    const snapshot = await Promise.race([uploadPromise, timeoutPromise]) as any;
    const downloadURL = await getDownloadURL(snapshot.ref);
    return downloadURL;
  } catch (error) {
    console.error("Error uploading to storage:", error);
    // If it's a timeout or error, we still need to return something.
    // If we return the base64, Firestore might reject it if it's too big (>1MB),
    // but at least it won't hang forever.
    return base64; 
  }
};

// --- REAL-TIME SUBSCRIPTIONS ---

export const subscribeToEmployees = (callback: (employees: Employee[]) => void, onError: (error: any) => void) => {
  const q = query(collection(db, "employees"), orderBy("lastName"));
  return onSnapshot(q, (snapshot) => {
    const employees = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Employee));
    callback(employees);
  }, onError);
};

export const subscribeToPlazas = (callback: (plazas: Plaza[]) => void, onError: (error: any) => void) => {
  const q = query(collection(db, "plazas"), orderBy("name"));
  return onSnapshot(q, (snapshot) => {
    const plazas = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Plaza));
    callback(plazas);
  }, onError);
};

export const subscribeToTasks = (callback: (tasks: Task[]) => void, onError: (error: any) => void) => {
  const q = query(collection(db, "tasks"), orderBy("dueDate"));
  return onSnapshot(q, (snapshot) => {
    const tasks = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Task));
    callback(tasks);
  }, onError);
};

export const subscribeToAppSettings = (callback: (settings: AppSettings) => void, onError: (error: any) => void) => {
  const docRef = doc(db, "settings", "global_config");
  return onSnapshot(docRef, (docSnap) => {
    if (docSnap.exists()) {
      const data = docSnap.data();
      const DEFINITIVE_KEY = "AQ.Ab8RN6KBWwPbT4jL9GDFk7CMbfhEvTyTUlnVJixCxGTp28mApg";
      callback({
        companyName: data.companyName || '',
        mascotaName: data.mascotaName || 'Mascota',
        mascotaUrl: data.mascotaUrl || '',
        googleApiKey: data.googleApiKey || DEFINITIVE_KEY,
        imgbbApiKey: data.imgbbApiKey || '',
        appVersion: data.appVersion || '1.0.0',
        appStatusColor: data.appStatusColor || '#10B981',
        mobileNavSections: data.mobileNavSections || ['dashboard', 'personnel', 'expenses', 'tasks', 'fallos'],
        birthdayPrompt: data.birthdayPrompt || '',
        birthdayVideoPrompt: data.birthdayVideoPrompt || ''
      });
    }
  }, onError);
};

export const subscribeToDashboardExpenses = (startDate: string, endDate: string, callback: (expenses: Expense[]) => void, onError: (error: any) => void) => {
  const q = query(
    collection(db, "expenses"), 
    where("date", ">=", startDate), 
    where("date", "<=", endDate),
    orderBy("date", "desc")
  );
  return onSnapshot(q, (snapshot) => {
    const expenses = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Expense));
    callback(expenses);
  }, onError);
};

export const subscribeToAllExpenses = (callback: (expenses: Expense[]) => void, onError: (error: any) => void, limitCount: number = 100) => {
  const q = limitCount > 0 
    ? query(collection(db, "expenses"), orderBy("date", "desc"), limit(limitCount))
    : query(collection(db, "expenses"), orderBy("date", "desc"));
    
  return onSnapshot(q, (snapshot) => {
    const expenses = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Expense));
    callback(expenses);
  }, onError);
};

export const subscribeToAllFallos = (callback: (fallos: Fallo[]) => void, onError: (error: any) => void, limitCount: number = 100, startDate?: string) => {
  let q: Query<DocumentData>;
  const fallosRef = collection(db, "fallos");
  
  if (startDate) {
    q = query(fallosRef, where("date", ">=", startDate), orderBy("date", "desc"));
  } else if (limitCount > 0) {
    q = query(fallosRef, orderBy("date", "desc"), limit(limitCount));
  } else {
    q = query(fallosRef, orderBy("date", "desc"));
  }

  return onSnapshot(q, (snapshot) => {
    const fallos = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Fallo));
    callback(fallos);
  }, onError);
};

// -------------------------------

const compressBase64 = (base64: string): Promise<string> => {
  return new Promise((resolve) => {
    // 10s timeout for compression safety
    const timeout = setTimeout(() => resolve(base64), 10000);

    if (!base64 || base64.length < 500000) {
      clearTimeout(timeout);
      resolve(base64);
      return;
    }
    const img = new Image();
    img.src = base64;
    img.onload = () => {
      clearTimeout(timeout);
      const canvas = document.createElement('canvas');
      const MAX_WIDTH = 1024; 
      let width = img.width;
      let height = img.height;
      if (width > MAX_WIDTH) {
        height = (height * MAX_WIDTH) / width;
        width = MAX_WIDTH;
      }
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.7)); 
      } else {
        resolve(base64);
      }
    };
    img.onerror = () => {
      clearTimeout(timeout);
      resolve(base64);
    };
  });
};

export const verifyAccessCode = async (code: string): Promise<Employee | null> => {
  if (code === '0120') {
    return {
      id: 'admin_master',
      firstName: 'Cristobal Ramon',
      lastName: 'Moran Buenrostro',
      email: 'admin@oficina.com',
      position: 'Director General',
      plaza: 'Dirección', 
      category: 'Ejecutivos',
      birthDate: new Date().toISOString(),
      hireDate: new Date().toISOString(),
      phone: '',
      accessCode: '0120'
    };
  }
  try {
    const q = query(collection(db, "employees"), where("accessCode", "==", code), limit(1));
    const querySnapshot = await getDocs(q);
    if (!querySnapshot.empty) {
      const doc = querySnapshot.docs[0];
      return { id: doc.id, ...doc.data() } as Employee;
    }
  } catch (error) {
    console.error("Error verifying code:", error);
  }
  return null;
};

export const getEmployees = async (): Promise<Employee[]> => {
  const q = query(collection(db, "employees"), orderBy("lastName"));
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Employee));
};

export const addEmployee = async (employee: Omit<Employee, 'id'>) => {
  return await addDoc(collection(db, "employees"), employee);
};

export const updateEmployee = async (id: string, employee: Partial<Employee>) => {
  const employeeRef = doc(db, "employees", id);
  const { id: _, ...data } = employee as any; 
  return await updateDoc(employeeRef, data);
};

export const deleteEmployee = async (id: string) => {
  return await deleteDoc(doc(db, "employees", id));
};

// --- BATCH OPERATIONS FOR IMPORT ---

export const deleteAllEmployees = async () => {
  const querySnapshot = await getDocs(collection(db, "employees"));
  // Firestore batches are limited to 500 ops. We must loop.
  const batchSize = 500;
  const chunks = [];
  const docs = querySnapshot.docs;

  for (let i = 0; i < docs.length; i += batchSize) {
    chunks.push(docs.slice(i, i + batchSize));
  }

  for (const chunk of chunks) {
    const batch = writeBatch(db);
    chunk.forEach(doc => {
      batch.delete(doc.ref);
    });
    await batch.commit();
  }
};

export const saveEmployeesBatch = async (employees: Omit<Employee, 'id'>[]) => {
  const batchSize = 500;
  const chunks = [];
  
  for (let i = 0; i < employees.length; i += batchSize) {
    chunks.push(employees.slice(i, i + batchSize));
  }

  for (const chunk of chunks) {
    const batch = writeBatch(db);
    chunk.forEach(emp => {
      const docRef = doc(collection(db, "employees")); // Auto-ID
      batch.set(docRef, emp);
    });
    await batch.commit();
  }
};

// ------------------------------------

export const getPlazas = async (): Promise<Plaza[]> => {
  const q = query(collection(db, "plazas"), orderBy("name"));
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Plaza));
};

export const addPlaza = async (name: string) => {
  return await addDoc(collection(db, "plazas"), { name });
};

export const deletePlaza = async (id: string) => {
  return await deleteDoc(doc(db, "plazas", id));
};

export const getExpenses = async (): Promise<Expense[]> => {
  const q = query(collection(db, "expenses"), orderBy("date", "desc"), limit(100));
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Expense));
};

export const addExpense = async (expense: Omit<Expense, 'id'>) => {
  let finalTicketImage = expense.ticketImage;
  if (expense.ticketImage && !expense.ticketImage.startsWith('http')) {
    const fileName = `expense_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    finalTicketImage = await uploadBase64ToStorage(expense.ticketImage, `expenses/${fileName}`);
  }
  return await addDoc(collection(db, "expenses"), { ...expense, ticketImage: finalTicketImage });
};

export const getExpensesByDateRange = async (startDate: string, endDate: string): Promise<Expense[]> => {
  const q = query(
    collection(db, "expenses"), 
    where("date", ">=", startDate), 
    where("date", "<=", endDate),
    orderBy("date", "desc")
  );
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Expense));
};

export const updateExpense = async (id: string, expense: Partial<Expense>) => {
  const expenseRef = doc(db, "expenses", id);
  const { id: _, ...data } = expense as any;
  return await updateDoc(expenseRef, data);
};

export const deleteExpense = async (id: string) => {
  return await deleteDoc(doc(db, "expenses", id));
};

export const getTasks = async (): Promise<Task[]> => {
  const q = query(collection(db, "tasks"), orderBy("dueDate"));
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Task));
};

export const addTask = async (task: Omit<Task, 'id'>) => {
  return await addDoc(collection(db, "tasks"), task);
};

export const updateTask = async (id: string, task: Partial<Task>) => {
  const taskRef = doc(db, "tasks", id);
  const { id: _, ...data } = task as any;
  return await updateDoc(taskRef, data);
};

export const updateTaskStatus = async (id: string, status: TaskStatus) => {
  const taskRef = doc(db, "tasks", id);
  return await updateDoc(taskRef, { status });
};

export const deleteTask = async (id: string) => {
  return await deleteDoc(doc(db, "tasks", id));
};

export const getAppSettings = async (): Promise<AppSettings> => {
  try {
    const docRef = doc(db, "settings", "global_config");
    const docSnap = await getDoc(docRef);
    
    // Actualizada a la nueva llave
    const DEFINITIVE_KEY = "AQ.Ab8RN6KBWwPbT4jL9GDFk7CMbfhEvTyTUlnVJixCxGTp28mApg";

    if (docSnap.exists()) {
      const data = docSnap.data();
      return {
        companyName: data.companyName || '',
        mascotaName: data.mascotaName || 'Mascota',
        mascotaUrl: data.mascotaUrl || '',
        googleApiKey: data.googleApiKey || DEFINITIVE_KEY,
        imgbbApiKey: data.imgbbApiKey || '',
        appVersion: data.appVersion || '1.0.0',
        appStatusColor: data.appStatusColor || '#10B981',
        birthdayPrompt: data.birthdayPrompt || '',
        birthdayVideoPrompt: data.birthdayVideoPrompt || '',
        imprentaUrl: data.imprentaUrl || ''
      };
    } else {
      return {
        companyName: '',
        mascotaName: 'Mascota',
        mascotaUrl: '',
        googleApiKey: DEFINITIVE_KEY,
        imgbbApiKey: '',
        appVersion: '1.0.0',
        appStatusColor: '#10B981',
        birthdayPrompt: '',
        birthdayVideoPrompt: '',
        imprentaUrl: ''
      };
    }
  } catch (error) {
    console.error("Error fetching settings:", error);
    return { 
      companyName: '', 
      mascotaName: 'Mascota', 
      mascotaUrl: '', 
      googleApiKey: 'AQ.Ab8RN6KBWwPbT4jL9GDFk7CMbfhEvTyTUlnVJixCxGTp28mApg',
      imgbbApiKey: '',
      appVersion: '1.0.0',
      appStatusColor: '#10B981',
      birthdayPrompt: '',
      birthdayVideoPrompt: '',
      imprentaUrl: ''
    };
  }
};

export const updateAppSettings = async (settings: AppSettings) => {
  const docRef = doc(db, "settings", "global_config");
  await setDoc(docRef, settings, { merge: true });
};

export const getGalleryImages = async (): Promise<GeneratedImage[]> => {
  const q = query(collection(db, "gallery"), orderBy("createdAt", "desc"), limit(12));
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as GeneratedImage));
};

export const saveGalleryImage = async (image: Omit<GeneratedImage, 'id'>) => {
  const compressedUrl = await compressBase64(image.imageUrl);
  const fileName = `gallery_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  const storageUrl = await uploadBase64ToStorage(compressedUrl, `gallery/${fileName}`);
  return await addDoc(collection(db, "gallery"), { ...image, imageUrl: storageUrl });
};

export const deleteGalleryImage = async (id: string) => {
  return await deleteDoc(doc(db, "gallery", id));
};

import { getLocalDateString } from '../lib/dateUtils';

export const getDailyBirthdayCard = async (employeeId: string): Promise<{ imageUrl: string | null; videoUrl: string | null } | null> => {
  try {
    const today = getLocalDateString(); 
    const docId = `birthday_${today}_${employeeId}`;
    const docRef = doc(db, "daily_events", docId);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      const data = docSnap.data();
      return {
        imageUrl: data.imageUrl || null,
        videoUrl: data.videoUrl || null
      };
    }
    return null;
  } catch (e) {
    return null;
  }
};

export const saveDailyBirthdayCard = async (employeeId: string, imageUrl: string) => {
  try {
    const today = getLocalDateString();
    const docId = `birthday_${today}_${employeeId}`;
    const docRef = doc(db, "daily_events", docId);
    const compressedUrl = await compressBase64(imageUrl);
    const storageUrl = await uploadBase64ToStorage(compressedUrl, `birthdays/${docId}`);
    await setDoc(docRef, {
      imageUrl: storageUrl,
      employeeId,
      date: today,
      createdAt: new Date().toISOString()
    }, { merge: true });
  } catch (e) {
    console.error("Error saving daily birthday card", e);
  }
};

export const saveDailyBirthdayVideo = async (employeeId: string, videoUrl: string) => {
  try {
    const today = getLocalDateString();
    const docId = `birthday_${today}_${employeeId}`;
    const docRef = doc(db, "daily_events", docId);
    
    // Upload video base64 data to Firebase Storage for fast loading
    const storageUrl = await uploadBase64ToStorage(videoUrl, `birthdays/${docId}_video`);
    await setDoc(docRef, {
      videoUrl: storageUrl,
      employeeId,
      date: today,
      createdAt: new Date().toISOString()
    }, { merge: true });
  } catch (e) {
    console.error("Error saving daily birthday video", e);
  }
};

export interface DailyBirthdayEvent {
  id: string;
  employeeId: string;
  imageUrl?: string | null;
  videoUrl?: string | null;
  date: string;
  createdAt: string;
}

export const getAllDailyBirthdayEvents = async (): Promise<DailyBirthdayEvent[]> => {
  try {
    const q = query(collection(db, "daily_events"), orderBy("createdAt", "desc"), limit(24));
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as DailyBirthdayEvent));
  } catch (e) {
    console.error("Error fetching daily birthday events", e);
    return [];
  }
};

// --- FALLOS / DOCUMENTOS ---

export const getFallos = async (): Promise<Fallo[]> => {
  const q = query(collection(db, "fallos"), orderBy("date", "desc"), limit(100));
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Fallo));
};

// --- FALLOS MANAGEMENT ---

export const getBase64Fallos = async (): Promise<Fallo[]> => {
  const q = query(collection(db, "fallos"));
  const snapshot = await getDocs(q);
  return snapshot.docs
    .map(doc => ({ id: doc.id, ...doc.data() } as Fallo))
    .filter(f => f.imageUrl && f.imageUrl.startsWith('data:'));
};

export const deleteBase64Fallos = async () => {
  const base64Fallos = await getBase64Fallos();
  const deletePromises = base64Fallos.map(f => deleteDoc(doc(db, "fallos", f.id)));
  return await Promise.all(deletePromises);
};

export const importFallos = async (fallos: Omit<Fallo, 'id'>[]) => {
  const addPromises = fallos.map(f => addFallo(f));
  return await Promise.all(addPromises);
};

export const addFallo = async (fallo: Omit<Fallo, 'id'>) => {
  // Check if image is already a URL or needs processing
  let imageToProcess = fallo.imageUrl;
  
  if (!imageToProcess.startsWith('http')) {
    imageToProcess = await compressBase64(fallo.imageUrl);
  } else {
    // If it's already an http link, just save it
    return await addDoc(collection(db, "fallos"), { ...fallo });
  }
  
  try {
    const settings = await getAppSettings();
    const customImgbbKey = settings.imgbbApiKey || undefined;
    
    // Upload to imgBB
    const imageUrl = await uploadToImgBB(imageToProcess, customImgbbKey);
    
    return await addDoc(collection(db, "fallos"), { 
      ...fallo, 
      imageUrl: imageUrl 
    });
  } catch (e: any) {
    console.error("imgBB upload failure, falling back to Firebase Storage:", e);
    
    // Fallback to Firebase Storage as secondary
    try {
      const fileName = `fallos/fallo_${Date.now()}_${Math.random().toString(36).substring(7)}`;
      const storageUrl = await uploadBase64ToStorage(imageToProcess, fileName);
      
      return await addDoc(collection(db, "fallos"), { 
        ...fallo, 
        imageUrl: storageUrl 
      });
    } catch (fallbackError: any) {
      throw new Error(`Error al subir imagen: ${e.message}. El respaldo de Firebase también falló.`);
    }
  }
};

export const deleteFallo = async (id: string) => {
  return await deleteDoc(doc(db, "fallos", id));
};
