import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { collection, doc, query, where } from "firebase/firestore";
import { db } from "../lib/firebase";
import { navigate } from "../lib/router";
import {
  errorMessage,
  formatDateTime,
  isHttpsUrl,
  joinList,
  splitList,
  trackLabels,
} from "../lib/validators";
import { useCollection, useDocument } from "../hooks/firestore";
import {
  bookAvailableSlot,
  cancelBooking,
  completeEtiquette,
  saveStudentProfile,
  uploadResume,
} from "../services/data";
import type { AlumniProfile, AvailabilitySlot, Booking, StudentProfile } from "../types";
import { Button, Card, Empty, Field, Form, Input, Notice, Status, Textarea } from "../components/ui";

export function StudentDashboard({ uid }: { uid: string }) {
  const profileRef = useMemo(() => doc(db, "studentProfiles", uid), [uid]);
  const alumniQuery = useMemo(() => query(collection(db, "alumniProfiles"), where("isPublished", "==", true)), []);
  const slotQuery = useMemo(() => query(collection(db, "availabilitySlots"), where("status", "==", "available")), []);
  const bookingQuery = useMemo(() => query(collection(db, "bookings"), where("studentId", "==", uid)), [uid]);
  const { data: profile } = useDocument<StudentProfile>(profileRef);
  const { data: alumni } = useCollection<AlumniProfile>(alumniQuery);
  const { data: slots } = useCollection<AvailabilitySlot>(slotQuery);
  const { data: bookings } = useCollection<Booking>(bookingQuery);
  const activeBookings = bookings.filter((booking) => booking.status === "confirmed");
  const history = bookings.filter((booking) => booking.status !== "confirmed");
  const profileComplete = Boolean(
    profile?.fullName && profile.program && profile.targetIndustry && profile.careerInterests?.length
  );
  const resumeReady = Boolean(profile?.resumeUrl);
  const etiquetteReady = profile?.etiquetteCompleted === true;
  const readyToBook = profileComplete && resumeReady && etiquetteReady;
  const nextStep = !profileComplete
    ? { label: "Complete profile", path: "/student/profile", detail: "Add program, industry, and interests." }
    : !resumeReady
      ? { label: "Upload resume", path: "/student/profile", detail: "Required before booking." }
      : !etiquetteReady
        ? { label: "Finish etiquette", path: "/student/etiquette", detail: "Confirm session expectations." }
        : { label: "Book session", path: "/student/alumni", detail: "Choose an available alumni slot." };

  return (
    <div className="stack">
      <PageTitle title="Student Dashboard" subtitle="Finish setup, then book a focused session." />
      <GuideCard
        title={readyToBook ? "Ready to book" : "Next step"}
        detail={nextStep.detail}
        actionLabel={nextStep.label}
        onAction={() => navigate(nextStep.path)}
      >
        <StepList
          steps={[
            { label: "Profile", done: profileComplete, path: "/student/profile" },
            { label: "Resume", done: resumeReady, path: "/student/profile" },
            { label: "Etiquette", done: etiquetteReady, path: "/student/etiquette" },
            { label: "Book", done: activeBookings.length > 0, path: "/student/alumni" },
          ]}
        />
      </GuideCard>
      <div className="grid two priorityGrid">
        <Card title="Recommended Alumni">
          <AlumniList alumni={alumni.slice(0, 3)} compact />
        </Card>
        <Card
          title="Available Sessions"
          action={<Button variant="ghost" onClick={() => navigate("/student/alumni")}>Browse</Button>}
        >
          <SlotList slots={slots.slice(0, 5)} alumni={alumni} />
        </Card>
      </div>
      <div className="grid two">
        <Card title="Upcoming Bookings">
          <BookingList bookings={activeBookings.slice(0, 4)} />
        </Card>
        <Card title="Booking History">
          <BookingList bookings={history.slice(0, 4)} />
        </Card>
      </div>
    </div>
  );
}

export function StudentProfilePage({ uid, displayName }: { uid: string; displayName: string }) {
  const profileRef = useMemo(() => doc(db, "studentProfiles", uid), [uid]);
  const { data: profile } = useDocument<StudentProfile>(profileRef);
  const [fullName, setFullName] = useState(displayName);
  const [program, setProgram] = useState("");
  const [targetIndustry, setTargetIndustry] = useState("");
  const [careerInterests, setCareerInterests] = useState("");
  const [linkedinUrl, setLinkedinUrl] = useState("");
  const [meetingGoals, setMeetingGoals] = useState("");
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!profile) return;
    setFullName(profile.fullName || displayName);
    setProgram(profile.program || "");
    setTargetIndustry(profile.targetIndustry || "");
    setCareerInterests(joinList(profile.careerInterests));
    setLinkedinUrl(profile.linkedinUrl || "");
    setMeetingGoals(profile.meetingGoals || "");
  }, [displayName, profile]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setNotice("");

    const interests = splitList(careerInterests);
    if (!fullName.trim() || !program.trim() || !targetIndustry.trim() || interests.length === 0) {
      setError("Complete the required fields.");
      return;
    }

    if (linkedinUrl && !isHttpsUrl(linkedinUrl)) {
      setError("LinkedIn URL must start with https://");
      return;
    }

    setLoading(true);
    try {
      await saveStudentProfile(uid, {
        fullName,
        program,
        targetIndustry,
        careerInterests: interests,
        linkedinUrl,
        meetingGoals,
      });
      if (resumeFile) {
        await uploadResume(uid, resumeFile);
        setResumeFile(null);
      }
      setNotice("Profile saved.");
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="stack narrow">
      <PageTitle title="Student Profile" />
      {notice && <Notice type="success">{notice}</Notice>}
      {error && <Notice type="error">{error}</Notice>}
      <Card>
        <Form onSubmit={submit}>
          <Field label="Full name">
            <Input value={fullName} onChange={(event) => setFullName(event.target.value)} required />
          </Field>
          <Field label="Program">
            <Input value={program} onChange={(event) => setProgram(event.target.value)} required />
          </Field>
          <Field label="Target industry">
            <Input value={targetIndustry} onChange={(event) => setTargetIndustry(event.target.value)} required />
          </Field>
          <Field label="Career interests">
            <Input value={careerInterests} onChange={(event) => setCareerInterests(event.target.value)} required />
          </Field>
          <Field label="LinkedIn URL">
            <Input type="url" value={linkedinUrl} onChange={(event) => setLinkedinUrl(event.target.value)} />
          </Field>
          <Field label="Meeting goals">
            <Textarea value={meetingGoals} onChange={(event) => setMeetingGoals(event.target.value)} rows={4} />
          </Field>
          <Field label="Resume">
            <Input
              type="file"
              accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              onChange={(event) => setResumeFile(event.target.files?.[0] || null)}
            />
          </Field>
          {profile?.resumeUrl && (
            <a className="inlineLink" href={profile.resumeUrl} target="_blank" rel="noreferrer">
              Current resume
            </a>
          )}
          <Button loading={loading} type="submit">
            Save profile
          </Button>
        </Form>
      </Card>
    </div>
  );
}

export function StudentAlumniPage({ uid }: { uid: string }) {
  const profileRef = useMemo(() => doc(db, "studentProfiles", uid), [uid]);
  const alumniQuery = useMemo(() => query(collection(db, "alumniProfiles"), where("isPublished", "==", true)), []);
  const slotQuery = useMemo(() => query(collection(db, "availabilitySlots"), where("status", "==", "available")), []);
  const { data: profile } = useDocument<StudentProfile>(profileRef);
  const { data: alumni } = useCollection<AlumniProfile>(alumniQuery);
  const { data: slots } = useCollection<AvailabilitySlot>(slotQuery);
  const [bookingSlot, setBookingSlot] = useState<AvailabilitySlot | null>(null);
  const [goals, setGoals] = useState("");
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  async function submitBooking() {
    if (!bookingSlot) return;
    const sessionGoals = splitList(goals);
    if (sessionGoals.length === 0) {
      setError("Add at least one session goal.");
      return;
    }
    setLoading(true);
    setError("");
    setNotice("");
    try {
      await bookAvailableSlot(bookingSlot.slotId, sessionGoals);
      setNotice("Booking confirmed.");
      setBookingSlot(null);
      setGoals("");
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  const ready = Boolean(profile?.resumeUrl && profile?.etiquetteCompleted);

  return (
    <div className="stack">
      <PageTitle title="Browse Alumni" />
      {!ready && <Notice type="warning">Complete resume and etiquette before booking.</Notice>}
      {notice && <Notice type="success">{notice}</Notice>}
      {error && <Notice type="error">{error}</Notice>}
      <div className="alumniGrid">
        {alumni.length === 0 && <Empty>No published alumni profiles yet.</Empty>}
        {alumni.map((person) => {
          const personSlots = slots.filter((slot) => slot.alumniId === person.uid);
          return (
            <Card key={person.uid} className="profileCard">
              <div className="profileHeader">
                {person.profilePhotoUrl ? (
                  <img src={person.profilePhotoUrl} alt="" />
                ) : (
                  <div className="avatar">{person.fullName.slice(0, 1)}</div>
                )}
                <div>
                  <h2>{person.fullName}</h2>
                  <p>{person.title} - {person.company}</p>
                </div>
              </div>
              <p className="bio">{person.bio}</p>
              <div className="chips">{person.supportAreas.map((area) => <span key={area}>{area}</span>)}</div>
              <div className="slotStack">
                {personSlots.length === 0 && <p className="muted compact">No open slots.</p>}
                {personSlots.slice(0, 3).map((slot) => (
                  <button className="slotButton" key={slot.slotId} disabled={!ready} onClick={() => setBookingSlot(slot)}>
                    <span>{trackLabels[slot.track]}</span>
                    <strong>{formatDateTime(slot.startTime)}</strong>
                  </button>
                ))}
              </div>
            </Card>
          );
        })}
      </div>
      {bookingSlot && (
        <div className="modalBackdrop" role="presentation">
          <Card title="Book Session" className="modal">
            <Field label="Session goals">
              <Textarea value={goals} onChange={(event) => setGoals(event.target.value)} rows={4} autoFocus />
            </Field>
            <div className="actions">
              <Button loading={loading} onClick={submitBooking}>Confirm booking</Button>
              <Button variant="secondary" onClick={() => setBookingSlot(null)}>Cancel</Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}

export function StudentBookingsPage({ uid }: { uid: string }) {
  const bookingQuery = useMemo(() => query(collection(db, "bookings"), where("studentId", "==", uid)), [uid]);
  const slotQuery = useMemo(() => query(collection(db, "availabilitySlots")), []);
  const alumniQuery = useMemo(() => query(collection(db, "alumniProfiles"), where("isPublished", "==", true)), []);
  const { data: bookings } = useCollection<Booking>(bookingQuery);
  const { data: slots } = useCollection<AvailabilitySlot>(slotQuery);
  const { data: alumni } = useCollection<AlumniProfile>(alumniQuery);
  const [cancelId, setCancelId] = useState("");
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function confirmCancel() {
    if (!cancelId) return;
    setLoading(true);
    setError("");
    try {
      await cancelBooking(cancelId, reason);
      setCancelId("");
      setReason("");
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="stack">
      <PageTitle title="Bookings" />
      {error && <Notice type="error">{error}</Notice>}
      <Card>
        <table>
          <thead>
            <tr>
              <th>Alumni</th>
              <th>Session</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {bookings.map((booking) => {
              const slot = slots.find((item) => item.slotId === booking.slotId);
              const person = alumni.find((item) => item.uid === booking.alumniId);
              return (
                <tr key={booking.bookingId}>
                  <td>{person?.fullName || booking.alumniId}</td>
                  <td>{slot ? `${trackLabels[slot.track]} - ${formatDateTime(slot.startTime)}` : booking.slotId}</td>
                  <td><Status value={booking.status} /></td>
                  <td>
                    {booking.status === "confirmed" && (
                      <Button variant="ghost" onClick={() => setCancelId(booking.bookingId)}>Cancel</Button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {bookings.length === 0 && <Empty>No bookings yet.</Empty>}
      </Card>
      {cancelId && (
        <div className="modalBackdrop" role="presentation">
          <Card title="Cancel Booking" className="modal">
            <Field label="Reason">
              <Textarea value={reason} onChange={(event) => setReason(event.target.value)} rows={3} autoFocus />
            </Field>
            <div className="actions">
              <Button variant="danger" loading={loading} onClick={confirmCancel}>Cancel booking</Button>
              <Button variant="secondary" onClick={() => setCancelId("")}>Keep booking</Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}

export function StudentEtiquettePage({ uid }: { uid: string }) {
  const profileRef = useMemo(() => doc(db, "studentProfiles", uid), [uid]);
  const { data: profile } = useDocument<StudentProfile>(profileRef);
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const items = [
    ["prepareQuestions", "I will prepare at least 3 questions before the session."],
    ["uploadResume", "I will upload my latest resume before booking."],
    ["joinOnTime", "I will join the session on time."],
    ["professionalCommunication", "I will communicate professionally with alumni."],
    ["sendThankYouNote", "I will send a thank-you note after the session."],
  ] as const;
  const allChecked = items.every(([key]) => checked[key]);

  async function complete() {
    setLoading(true);
    setError("");
    try {
      await completeEtiquette(uid);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="stack narrow">
      <PageTitle title="Etiquette Checklist" />
      {profile?.etiquetteCompleted && <Notice type="success">Checklist complete.</Notice>}
      {error && <Notice type="error">{error}</Notice>}
      <Card>
        <div className="checkList">
          {items.map(([key, label]) => (
            <label key={key} className="checkRow">
              <input
                type="checkbox"
                checked={checked[key] || profile?.etiquetteCompleted || false}
                disabled={profile?.etiquetteCompleted}
                onChange={(event) => setChecked((current) => ({ ...current, [key]: event.target.checked }))}
              />
              <span>{label}</span>
            </label>
          ))}
        </div>
        {!profile?.etiquetteCompleted && (
          <Button loading={loading} disabled={!allChecked} onClick={complete}>
            Complete checklist
          </Button>
        )}
      </Card>
    </div>
  );
}

function PageTitle({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="pageTitle">
      <h1>{title}</h1>
      {subtitle && <p>{subtitle}</p>}
    </div>
  );
}

function GuideCard({
  title,
  detail,
  actionLabel,
  onAction,
  children,
}: {
  title: string;
  detail: string;
  actionLabel: string;
  onAction: () => void;
  children: ReactNode;
}) {
  return (
    <Card className="guideCard">
      <div className="guideContent">
        <div>
          <h2>{title}</h2>
          <p>{detail}</p>
        </div>
        <Button onClick={onAction}>{actionLabel}</Button>
      </div>
      {children}
    </Card>
  );
}

function StepList({ steps }: { steps: Array<{ label: string; done: boolean; path: string }> }) {
  return (
    <div className="stepList">
      {steps.map((step, index) => (
        <button key={step.label} className={step.done ? "stepItem done" : "stepItem"} onClick={() => navigate(step.path)}>
          <span>{step.done ? "✓" : index + 1}</span>
          {step.label}
        </button>
      ))}
    </div>
  );
}

function AlumniList({ alumni, compact = false }: { alumni: AlumniProfile[]; compact?: boolean }) {
  if (alumni.length === 0) return <Empty>No alumni profiles yet.</Empty>;
  return (
    <div className={compact ? "list compactList" : "list"}>
      {alumni.map((person) => (
        <div className="listRow" key={person.uid}>
          <div>
            <strong>{person.fullName}</strong>
            <span>{person.title} - {person.company}</span>
          </div>
          <Status value={person.industry} />
        </div>
      ))}
    </div>
  );
}

function SlotList({ slots, alumni }: { slots: AvailabilitySlot[]; alumni: AlumniProfile[] }) {
  if (slots.length === 0) return <Empty>No available sessions.</Empty>;
  return (
    <div className="list">
      {slots.map((slot) => {
        const person = alumni.find((item) => item.uid === slot.alumniId);
        return (
          <div className="listRow" key={slot.slotId}>
            <div>
              <strong>{trackLabels[slot.track]}</strong>
              <span>{person?.fullName || "Alumni"} - {formatDateTime(slot.startTime)}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function BookingList({ bookings }: { bookings: Booking[] }) {
  if (bookings.length === 0) return <Empty>No bookings.</Empty>;
  return (
    <div className="list">
      {bookings.map((booking) => (
        <div className="listRow" key={booking.bookingId}>
          <div>
            <strong>{booking.sessionGoals?.[0] || "Career session"}</strong>
            <span>{booking.bookingId}</span>
          </div>
          <Status value={booking.status} />
        </div>
      ))}
    </div>
  );
}
