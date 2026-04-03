
export type PersonnelCategory = 'Oficina' | 'Ejecutivos' | 'Supervisoras' | 'Promotoras';

export interface Plaza {
  id: string;
  name: string;
}

declare global {
  interface Window {
    gapi: any;
    google: any;
  }
}

export interface Employee {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  position: string;
  plaza: string; // Renamed from department
  category: PersonnelCategory;
  birthDate: string; // ISO string YYYY-MM-DD
  hireDate: string;
  phone: string;
  avatarUrl?: string;
  accessCode?: string; // Código de 4 dígitos
  
  // Hierarchy Fields
  linkedExecutiveId?: string; // Para Supervisoras y Promotoras (ID del Ejecutivo)
  linkedSupervisorId?: string; // Para Promotoras (ID de la Supervisora)
  groupName?: string; // Para Promotoras (Nombre del Grupo)
  supervisionName?: string; // Para Supervisoras (Nombre de la Supervisión)
}

export interface Expense {
  id: string;
  description: string;
  amount: number;
  category: 'Oficina' | 'Comida' | 'Transporte' | 'Software' | 'Servicios' | 'Otros';
  date: string;
  approvedBy?: string;
  ticketImage?: string; // Base64 string of the receipt/ticket
}

export enum TaskStatus {
  TODO = 'Por Hacer',
  IN_PROGRESS = 'En Progreso',
  DONE = 'Completado'
}

export interface Task {
  id: string;
  title: string;
  description?: string;
  assignedTo?: string; // Employee ID or Name
  dueDate: string;
  status: TaskStatus;
  priority: 'Baja' | 'Media' | 'Alta';
  attachmentUrl?: string; // Archivo adjunto al crear la tarea
  deliveryUrl?: string;   // Archivo de entrega al finalizar la tarea
  deliveredAt?: string;   // Fecha de entrega
}

export interface AiInsight {
  type: 'expense' | 'productivity' | 'general';
  message: string;
  timestamp: number;
}

export interface AppSettings {
  companyName: string;
  mascotaName: string;
  mascotaUrl: string;
  googleApiKey?: string;
  appVersion?: string;
  appStatusColor?: string;
}

export interface GeneratedImage {
  id: string;
  imageUrl: string; // Base64 or URL
  prompt: string;
  createdAt: string; // ISO String
}

export interface Fallo {
  id: string;
  imageUrl: string;
  description: string;
  promotoraId?: string; // ID of the linked Promotora
  promotoraName?: string; // Name for easier display
  groupName?: string; // Group name (auto-filled from Promotora or manual)
  date: string;
  createdAt: string;
}
