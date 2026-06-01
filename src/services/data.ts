import {
  collection,
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  writeBatch,
} from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { db, functions, storage } from "../lib/firebase";
import { isUcrEmail, safeFileName } from "../lib/validators";
import type { Role, SlotTrack } from "../types";

export async function createUserRole(params: {
  uid: string;
  role: Role;
  name: string;
  email: string;
  photoURL?: string | null;
}) {
  if (params.role === "student" && !isUcrEmail(params.email)) {
    throw new Error("Students must sign in with a UCR email address.");
  }

  await setDoc(doc(db, "users", params.uid), {
    uid: params.uid,
    role: params.role,
    name: params.name,
    email: params.email,
    photoURL: params.photoURL || null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    lastLoginAt: serverTimestamp(),
  });
}

export async function sendAdminInvite(email: string) {
  const callable = httpsCallable(functions, "sendAdminInvite");
  return callable({ email });
}

export async function acceptAdminInvite(email: string, token: string) {
  const callable = httpsCallable(functions, "acceptAdminInvite");
  return callable({ email, token });
}

export async function saveStudentProfile(
  uid: string,
  values: {
    ucrEmail: string;
    fullName: string;
    program: string;
    targetIndustry: string;
    careerInterests: string[];
    linkedinUrl?: string;
    meetingGoals?: string;
  }
) {
  const ref = doc(db, "studentProfiles", uid);
  const snapshot = await getDoc(ref);
  await setDoc(
    ref,
    {
      uid,
      ucrEmail: values.ucrEmail.trim(),
      fullName: values.fullName.trim(),
      program: values.program.trim(),
      targetIndustry: values.targetIndustry.trim(),
      careerInterests: values.careerInterests,
      linkedinUrl: values.linkedinUrl?.trim() || null,
      meetingGoals: values.meetingGoals?.trim() || null,
      etiquetteCompleted: snapshot.exists() ? snapshot.data().etiquetteCompleted === true : false,
      updatedAt: serverTimestamp(),
      ...(snapshot.exists() ? {} : { createdAt: serverTimestamp() }),
    },
    { merge: true }
  );
}

export async function uploadResume(uid: string, file: File) {
  const path = `resumes/${uid}/${Date.now()}-${safeFileName(file.name)}`;
  const fileRef = ref(storage, path);
  await uploadBytes(fileRef, file, { contentType: file.type });
  const resumeUrl = await getDownloadURL(fileRef);
  await updateDoc(doc(db, "studentProfiles", uid), {
    resumeUrl,
    updatedAt: serverTimestamp(),
  });
  return resumeUrl;
}

export async function completeEtiquette(uid: string, ucrEmail: string) {
  const batch = writeBatch(db);
  batch.set(doc(db, "etiquetteChecklist", uid), {
    uid,
    completed: true,
    completedAt: serverTimestamp(),
    answers: {
      prepareQuestions: true,
      uploadResume: true,
      joinOnTime: true,
      professionalCommunication: true,
      sendThankYouNote: true,
    },
  });
  batch.update(doc(db, "studentProfiles", uid), {
    ucrEmail: ucrEmail.trim(),
    etiquetteCompleted: true,
    updatedAt: serverTimestamp(),
  });
  await batch.commit();
}

export async function saveAlumniProfile(
  uid: string,
  values: {
    fullName: string;
    title: string;
    company: string;
    industry: string;
    functionArea: string;
    location?: string;
    bio: string;
    supportAreas: string[];
    linkedinUrl: string;
    isPublished: boolean;
  }
) {
  const ref = doc(db, "alumniProfiles", uid);
  const snapshot = await getDoc(ref);
  await setDoc(
    ref,
    {
      uid,
      fullName: values.fullName.trim(),
      title: values.title.trim(),
      company: values.company.trim(),
      industry: values.industry.trim(),
      functionArea: values.functionArea.trim(),
      location: values.location?.trim() || null,
      bio: values.bio.trim(),
      supportAreas: values.supportAreas,
      linkedinUrl: values.linkedinUrl.trim(),
      isPublished: values.isPublished,
      updatedAt: serverTimestamp(),
      ...(snapshot.exists() ? {} : { createdAt: serverTimestamp() }),
    },
    { merge: true }
  );
}

export async function uploadProfilePhoto(uid: string, file: File) {
  const path = `profilePhotos/${uid}/${Date.now()}-${safeFileName(file.name)}`;
  const fileRef = ref(storage, path);
  await uploadBytes(fileRef, file, { contentType: file.type });
  const profilePhotoUrl = await getDownloadURL(fileRef);
  await updateDoc(doc(db, "alumniProfiles", uid), {
    profilePhotoUrl,
    updatedAt: serverTimestamp(),
  });
  return profilePhotoUrl;
}

export async function createAvailabilitySlot(
  uid: string,
  values: {
    startTime: Date;
    endTime: Date;
    track: SlotTrack;
  }
) {
  const ref = doc(collection(db, "availabilitySlots"));
  await setDoc(ref, {
    slotId: ref.id,
    alumniId: uid,
    startTime: Timestamp.fromDate(values.startTime),
    endTime: Timestamp.fromDate(values.endTime),
    track: values.track,
    status: "available",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

export async function cancelAvailabilitySlot(slotId: string) {
  await updateDoc(doc(db, "availabilitySlots", slotId), {
    status: "cancelled",
    updatedAt: serverTimestamp(),
  });
}

export async function bookAvailableSlot(slotId: string, sessionGoals: string[]) {
  const callable = httpsCallable(functions, "bookSlot");
  return callable({ slotId, sessionGoals });
}

export async function cancelBooking(bookingId: string, cancellationReason: string) {
  const callable = httpsCallable(functions, "cancelBooking");
  return callable({ bookingId, cancellationReason });
}
