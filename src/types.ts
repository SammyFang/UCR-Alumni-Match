import type { Timestamp } from "firebase/firestore";

export type Role = "student" | "alumni" | "admin";
export type SlotTrack = "mockInterview" | "resumeReview" | "careerChat" | "industryConversation";
export type SlotStatus = "available" | "booked" | "cancelled";
export type BookingStatus = "confirmed" | "cancelled" | "completed" | "flagged";

export interface AppUser {
  uid: string;
  role: Role;
  name: string;
  email: string;
  photoURL?: string | null;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
  lastLoginAt?: Timestamp;
}

export interface StudentProfile {
  uid: string;
  ucrEmail?: string;
  fullName: string;
  program: string;
  targetIndustry: string;
  careerInterests: string[];
  linkedinUrl?: string | null;
  resumeUrl?: string | null;
  meetingGoals?: string | null;
  etiquetteCompleted: boolean;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface AlumniProfile {
  uid: string;
  fullName: string;
  title: string;
  company: string;
  industry: string;
  functionArea: string;
  location?: string | null;
  bio: string;
  supportAreas: string[];
  linkedinUrl: string;
  profilePhotoUrl?: string | null;
  isPublished: boolean;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface AvailabilitySlot {
  slotId: string;
  alumniId: string;
  startTime: Timestamp;
  endTime: Timestamp;
  track: SlotTrack;
  status: SlotStatus;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface Booking {
  bookingId: string;
  studentId: string;
  alumniId: string;
  slotId: string;
  resumeUrl: string;
  sessionGoals: string[];
  status: BookingStatus;
  meetingLink?: string | null;
  cancellationReason?: string | null;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface EtiquetteChecklist {
  uid: string;
  completed: boolean;
  completedAt?: Timestamp;
  answers: {
    prepareQuestions: boolean;
    uploadResume: boolean;
    joinOnTime: boolean;
    professionalCommunication: boolean;
    sendThankYouNote: boolean;
  };
}

export interface AdminInvite {
  email: string;
  invitedBy: string;
  invitedByEmail: string;
  status: "pending" | "accepted" | "revoked";
  inviteUrl?: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
  expiresAt?: Timestamp;
  acceptedAt?: Timestamp;
  acceptedByUid?: string;
}
