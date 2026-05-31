import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { collection, doc, query, where } from "firebase/firestore";
import { db } from "../lib/firebase";
import { navigate } from "../lib/router";
import {
  errorMessage,
  formatDateTime,
  fromLocalInputValue,
  isLinkedInUrl,
  joinList,
  splitList,
  toLocalInputValue,
  trackLabels,
} from "../lib/validators";
import { useCollection, useDocument } from "../hooks/firestore";
import {
  cancelAvailabilitySlot,
  createAvailabilitySlot,
  saveAlumniProfile,
  uploadProfilePhoto,
} from "../services/data";
import type { AlumniProfile, AvailabilitySlot, Booking, SlotTrack } from "../types";
import { Button, Card, Empty, Field, Form, Input, Notice, Select, Status, Textarea } from "../components/ui";

export function AlumniDashboard({ uid }: { uid: string }) {
  const profileRef = useMemo(() => doc(db, "alumniProfiles", uid), [uid]);
  const slotQuery = useMemo(() => query(collection(db, "availabilitySlots"), where("alumniId", "==", uid)), [uid]);
  const bookingQuery = useMemo(() => query(collection(db, "bookings"), where("alumniId", "==", uid)), [uid]);
  const { data: profile } = useDocument<AlumniProfile>(profileRef);
  const { data: slots } = useCollection<AvailabilitySlot>(slotQuery);
  const { data: bookings } = useCollection<Booking>(bookingQuery);
  const now = Date.now();
  const upcoming = bookings.filter((booking) => booking.status === "confirmed");
  const profilePublished = profile?.isPublished === true;
  const openSlots = slots.filter((slot) => slot.status === "available").length;
  const past = bookings.filter((booking) => {
    const slot = slots.find((item) => item.slotId === booking.slotId);
    return booking.status !== "confirmed" || (slot?.endTime?.toMillis() || now + 1) < now;
  });
  const nextStep = !profilePublished
    ? { label: "Publish profile", path: "/alumni/profile", detail: "Complete your profile so students can find you." }
    : openSlots === 0
      ? { label: "Add availability", path: "/alumni/availability", detail: "Create one open slot for students." }
      : { label: "Review bookings", path: "/alumni/bookings", detail: "Keep upcoming sessions easy to scan." };

  return (
    <div className="stack">
      <PageTitle title="Alumni Dashboard" subtitle="Publish, add availability, then review sessions." />
      <GuideCard
        title="Next step"
        detail={nextStep.detail}
        actionLabel={nextStep.label}
        onAction={() => navigate(nextStep.path)}
      >
        <StepList
          steps={[
            { label: "Profile", done: profilePublished, path: "/alumni/profile" },
            { label: "Availability", done: openSlots > 0, path: "/alumni/availability" },
            { label: "Bookings", done: upcoming.length > 0, path: "/alumni/bookings" },
          ]}
        />
      </GuideCard>
      <div className="grid two">
        <Card title="Upcoming Student Bookings" action={<Status value={`${upcoming.length}`} />}>
          <AlumniBookingList bookings={upcoming} slots={slots} />
        </Card>
        <Card title="My Availability Slots" action={<Status value={`${openSlots} open`} />}>
          <SlotTable slots={slots.slice(0, 5)} onCancel={() => undefined} compact />
        </Card>
      </div>
      <div className="grid two">
        <Card title="My Alumni Profile">
          <div className="statusLine">
            <Status value={profilePublished ? "published" : "draft"} />
            <strong>{profile?.fullName || "Profile needed"}</strong>
          </div>
        </Card>
        <Card title="Past Sessions">
          <AlumniBookingList bookings={past} slots={slots} />
        </Card>
      </div>
    </div>
  );
}

export function AlumniProfilePage({ uid, displayName }: { uid: string; displayName: string }) {
  const profileRef = useMemo(() => doc(db, "alumniProfiles", uid), [uid]);
  const { data: profile } = useDocument<AlumniProfile>(profileRef);
  const [fullName, setFullName] = useState(displayName);
  const [title, setTitle] = useState("");
  const [company, setCompany] = useState("");
  const [industry, setIndustry] = useState("");
  const [functionArea, setFunctionArea] = useState("");
  const [location, setLocation] = useState("");
  const [bio, setBio] = useState("");
  const [supportAreas, setSupportAreas] = useState("");
  const [linkedinUrl, setLinkedinUrl] = useState("");
  const [isPublished, setIsPublished] = useState(false);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!profile) return;
    setFullName(profile.fullName || displayName);
    setTitle(profile.title || "");
    setCompany(profile.company || "");
    setIndustry(profile.industry || "");
    setFunctionArea(profile.functionArea || "");
    setLocation(profile.location || "");
    setBio(profile.bio || "");
    setSupportAreas(joinList(profile.supportAreas));
    setLinkedinUrl(profile.linkedinUrl || "");
    setIsPublished(profile.isPublished);
  }, [displayName, profile]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setNotice("");
    const areas = splitList(supportAreas);
    if (!fullName.trim() || !title.trim() || !company.trim() || !industry.trim() || !functionArea.trim() || areas.length === 0) {
      setError("Complete the required fields.");
      return;
    }
    if (bio.trim().length < 20) {
      setError("Bio must be at least 20 characters.");
      return;
    }
    if (!isLinkedInUrl(linkedinUrl)) {
      setError("Enter a valid LinkedIn profile URL.");
      return;
    }

    setLoading(true);
    try {
      await saveAlumniProfile(uid, {
        fullName,
        title,
        company,
        industry,
        functionArea,
        location,
        bio,
        supportAreas: areas,
        linkedinUrl,
        isPublished,
      });
      if (photoFile) {
        await uploadProfilePhoto(uid, photoFile);
        setPhotoFile(null);
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
      <PageTitle title="Alumni Profile" />
      {notice && <Notice type="success">{notice}</Notice>}
      {error && <Notice type="error">{error}</Notice>}
      <Card>
        <Form onSubmit={submit}>
          <Field label="Full name">
            <Input value={fullName} onChange={(event) => setFullName(event.target.value)} required />
          </Field>
          <Field label="Current title">
            <Input value={title} onChange={(event) => setTitle(event.target.value)} required />
          </Field>
          <Field label="Company">
            <Input value={company} onChange={(event) => setCompany(event.target.value)} required />
          </Field>
          <Field label="Industry">
            <Input value={industry} onChange={(event) => setIndustry(event.target.value)} required />
          </Field>
          <Field label="Function area">
            <Input value={functionArea} onChange={(event) => setFunctionArea(event.target.value)} required />
          </Field>
          <Field label="Location">
            <Input value={location} onChange={(event) => setLocation(event.target.value)} />
          </Field>
          <Field label="Short bio">
            <Textarea value={bio} onChange={(event) => setBio(event.target.value)} rows={5} required />
          </Field>
          <Field label="Support areas">
            <Input value={supportAreas} onChange={(event) => setSupportAreas(event.target.value)} required />
          </Field>
          <Field label="LinkedIn profile URL">
            <Input type="url" value={linkedinUrl} onChange={(event) => setLinkedinUrl(event.target.value)} required />
          </Field>
          <Field label="Profile photo">
            <Input type="file" accept="image/*" onChange={(event) => setPhotoFile(event.target.files?.[0] || null)} />
          </Field>
          <label className="toggle">
            <input type="checkbox" checked={isPublished} onChange={(event) => setIsPublished(event.target.checked)} />
            <span>Publish profile</span>
          </label>
          <Button loading={loading} type="submit">Save profile</Button>
        </Form>
      </Card>
    </div>
  );
}

export function AlumniAvailabilityPage({ uid }: { uid: string }) {
  const slotQuery = useMemo(() => query(collection(db, "availabilitySlots"), where("alumniId", "==", uid)), [uid]);
  const { data: slots } = useCollection<AvailabilitySlot>(slotQuery);
  const defaultStart = toLocalInputValue(new Date(Date.now() + 24 * 60 * 60 * 1000));
  const defaultEnd = toLocalInputValue(new Date(Date.now() + 24 * 60 * 60 * 1000 + 30 * 60 * 1000));
  const [startTime, setStartTime] = useState(defaultStart);
  const [endTime, setEndTime] = useState(defaultEnd);
  const [track, setTrack] = useState<SlotTrack>("careerChat");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const start = fromLocalInputValue(startTime);
    const end = fromLocalInputValue(endTime);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start || start <= new Date()) {
      setError("Choose a valid future time.");
      return;
    }

    setLoading(true);
    try {
      await createAvailabilitySlot(uid, { startTime: start, endTime: end, track });
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  async function cancel(slotId: string) {
    setError("");
    try {
      await cancelAvailabilitySlot(slotId);
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  return (
    <div className="stack">
      <PageTitle title="Availability" />
      {error && <Notice type="error">{error}</Notice>}
      <div className="grid two">
        <Card title="Create Slot">
          <Form onSubmit={submit}>
            <Field label="Start time">
              <Input type="datetime-local" value={startTime} onChange={(event) => setStartTime(event.target.value)} required />
            </Field>
            <Field label="End time">
              <Input type="datetime-local" value={endTime} onChange={(event) => setEndTime(event.target.value)} required />
            </Field>
            <Field label="Track">
              <Select value={track} onChange={(event) => setTrack(event.target.value as SlotTrack)}>
                {Object.entries(trackLabels).map(([value, label]) => (
                  <option value={value} key={value}>{label}</option>
                ))}
              </Select>
            </Field>
            <Button loading={loading} type="submit">Create slot</Button>
          </Form>
        </Card>
        <Card title="My Availability Slots">
          <SlotTable slots={slots} onCancel={cancel} />
        </Card>
      </div>
    </div>
  );
}

export function AlumniBookingsPage({ uid }: { uid: string }) {
  const bookingQuery = useMemo(() => query(collection(db, "bookings"), where("alumniId", "==", uid)), [uid]);
  const slotQuery = useMemo(() => query(collection(db, "availabilitySlots"), where("alumniId", "==", uid)), [uid]);
  const { data: bookings } = useCollection<Booking>(bookingQuery);
  const { data: slots } = useCollection<AvailabilitySlot>(slotQuery);

  return (
    <div className="stack">
      <PageTitle title="Student Bookings" />
      <Card>
        <AlumniBookingTable bookings={bookings} slots={slots} />
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

function SlotTable({
  slots,
  onCancel,
  compact = false,
}: {
  slots: AvailabilitySlot[];
  onCancel: (slotId: string) => void;
  compact?: boolean;
}) {
  if (slots.length === 0) return <Empty>No slots yet.</Empty>;
  return (
    <table>
      <thead>
        <tr>
          <th>Track</th>
          <th>Time</th>
          <th>Status</th>
          {!compact && <th></th>}
        </tr>
      </thead>
      <tbody>
        {slots.map((slot) => (
          <tr key={slot.slotId}>
            <td>{trackLabels[slot.track]}</td>
            <td>{formatDateTime(slot.startTime)}</td>
            <td><Status value={slot.status} /></td>
            {!compact && (
              <td>
                {slot.status === "available" && <Button variant="ghost" onClick={() => onCancel(slot.slotId)}>Cancel</Button>}
              </td>
            )}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function AlumniBookingList({ bookings, slots }: { bookings: Booking[]; slots: AvailabilitySlot[] }) {
  if (bookings.length === 0) return <Empty>No bookings.</Empty>;
  return (
    <div className="list">
      {bookings.map((booking) => {
        const slot = slots.find((item) => item.slotId === booking.slotId);
        return (
          <div className="listRow" key={booking.bookingId}>
            <div>
              <strong>{slot ? trackLabels[slot.track] : "Session"}</strong>
              <span>{slot ? formatDateTime(slot.startTime) : booking.bookingId}</span>
            </div>
            <Status value={booking.status} />
          </div>
        );
      })}
    </div>
  );
}

function AlumniBookingTable({ bookings, slots }: { bookings: Booking[]; slots: AvailabilitySlot[] }) {
  if (bookings.length === 0) return <Empty>No bookings yet.</Empty>;
  return (
    <table>
      <thead>
        <tr>
          <th>Student</th>
          <th>Session</th>
          <th>Goals</th>
          <th>Status</th>
          <th>Resume</th>
        </tr>
      </thead>
      <tbody>
        {bookings.map((booking) => {
          const slot = slots.find((item) => item.slotId === booking.slotId);
          return (
            <tr key={booking.bookingId}>
              <td>{booking.studentId.slice(0, 8)}</td>
              <td>{slot ? `${trackLabels[slot.track]} - ${formatDateTime(slot.startTime)}` : booking.slotId}</td>
              <td>{booking.sessionGoals.join(", ")}</td>
              <td><Status value={booking.status} /></td>
              <td>
                <a href={booking.resumeUrl} target="_blank" rel="noreferrer" className="inlineLink">Open</a>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
