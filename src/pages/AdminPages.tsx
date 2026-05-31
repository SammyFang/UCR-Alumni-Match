import { useMemo, useState, type FormEvent } from "react";
import { collection, query, where } from "firebase/firestore";
import { db } from "../lib/firebase";
import { errorMessage, formatDateTime, trackLabels } from "../lib/validators";
import { useCollection } from "../hooks/firestore";
import { sendAdminInvite } from "../services/data";
import type { AdminInvite, AlumniProfile, AppUser, AvailabilitySlot, Booking, StudentProfile } from "../types";
import { Button, Card, Empty, Field, Form, Input, Notice, Status } from "../components/ui";

const SUPER_ADMIN_EMAIL = "yfang097@ucr.edu";

export function AdminDashboard() {
  const usersQuery = useMemo(() => query(collection(db, "users")), []);
  const studentQuery = useMemo(() => query(collection(db, "studentProfiles")), []);
  const alumniQuery = useMemo(() => query(collection(db, "alumniProfiles")), []);
  const bookingQuery = useMemo(() => query(collection(db, "bookings")), []);
  const flaggedQuery = useMemo(() => query(collection(db, "bookings"), where("status", "==", "flagged")), []);
  const { data: users } = useCollection<AppUser>(usersQuery);
  const { data: students } = useCollection<StudentProfile>(studentQuery);
  const { data: alumni } = useCollection<AlumniProfile>(alumniQuery);
  const { data: bookings } = useCollection<Booking>(bookingQuery);
  const { data: flagged } = useCollection<Booking>(flaggedQuery);

  return (
    <div className="stack">
      <PageTitle title="Admin Dashboard" subtitle="Review accounts, bookings, and late cancellations." />
      <Card className="guideCard">
        <div className="guideContent">
          <div>
            <h2>{flagged.length > 0 ? "Review flagged cancellations" : "No urgent review"}</h2>
            <p>{flagged.length > 0 ? "Start with late cancellations." : "System activity is ready to scan."}</p>
          </div>
          <Status value={`${flagged.length} flagged`} />
        </div>
      </Card>
      <div className="grid five">
        <Metric title="User List" value={users.length} />
        <Metric title="Student Profiles" value={students.length} />
        <Metric title="Alumni Profiles" value={alumni.length} />
        <Metric title="Booking Overview" value={bookings.length} />
        <Metric title="Flagged Cancellations" value={flagged.length} />
      </div>
    </div>
  );
}

export function AdminUsersPage() {
  const usersQuery = useMemo(() => query(collection(db, "users")), []);
  const studentQuery = useMemo(() => query(collection(db, "studentProfiles")), []);
  const alumniQuery = useMemo(() => query(collection(db, "alumniProfiles")), []);
  const { data: users } = useCollection<AppUser>(usersQuery);
  const { data: students } = useCollection<StudentProfile>(studentQuery);
  const { data: alumni } = useCollection<AlumniProfile>(alumniQuery);

  return (
    <div className="stack">
      <PageTitle title="Users" />
      <Card title="User List">
        <UserTable users={users} />
      </Card>
      <div className="grid two">
        <Card title="Student Profiles">
          <StudentTable students={students} />
        </Card>
        <Card title="Alumni Profiles">
          <AlumniTable alumni={alumni} />
        </Card>
      </div>
    </div>
  );
}

export function AdminBookingsPage() {
  const bookingQuery = useMemo(() => query(collection(db, "bookings")), []);
  const slotQuery = useMemo(() => query(collection(db, "availabilitySlots")), []);
  const { data: bookings } = useCollection<Booking>(bookingQuery);
  const { data: slots } = useCollection<AvailabilitySlot>(slotQuery);

  return (
    <div className="stack">
      <PageTitle title="Bookings" />
      <Card title="Booking Overview">
        <BookingTable bookings={bookings} slots={slots} />
      </Card>
    </div>
  );
}

export function AdminFlaggedPage() {
  const bookingQuery = useMemo(() => query(collection(db, "bookings"), where("status", "==", "flagged")), []);
  const slotQuery = useMemo(() => query(collection(db, "availabilitySlots")), []);
  const { data: bookings } = useCollection<Booking>(bookingQuery);
  const { data: slots } = useCollection<AvailabilitySlot>(slotQuery);

  return (
    <div className="stack">
      <PageTitle title="Flagged Cancellations" />
      <Card>
        <BookingTable bookings={bookings} slots={slots} />
      </Card>
    </div>
  );
}

export function AdminInvitesPage({ currentEmail }: { currentEmail: string }) {
  const canInvite = currentEmail.toLowerCase() === SUPER_ADMIN_EMAIL;
  const inviteQuery = useMemo(() => (canInvite ? query(collection(db, "adminInvites")) : null), [canInvite]);
  const { data: invites } = useCollection<AdminInvite>(inviteQuery);
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setNotice("");
    setError("");

    if (!canInvite) {
      setError("Only the primary admin can send invitations.");
      return;
    }

    setLoading(true);
    try {
      await sendAdminInvite(email);
      setNotice("Invitation queued and email prepared.");
      setEmail("");
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="stack">
      <PageTitle title="Admin Invites" subtitle="Only yfang097@ucr.edu can invite new admins." />
      {!canInvite && <Notice type="warning">You can manage records, but only the primary admin can invite admins.</Notice>}
      {notice && <Notice type="success">{notice}</Notice>}
      {error && <Notice type="error">{error}</Notice>}
      {canInvite && (
        <Card title="Invite Admin">
          <Form onSubmit={submit}>
            <Field label="Admin email">
              <Input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="name@ucr.edu"
                required
              />
            </Field>
            <Button loading={loading} type="submit">Send invite</Button>
          </Form>
        </Card>
      )}
      <Card title="Invitations">
        {invites.length === 0 ? <Empty>No invitations yet.</Empty> : <InviteTable invites={invites} />}
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

function Metric({ title, value }: { title: string; value: number }) {
  return (
    <Card title={title}>
      <div className="metric">{value}</div>
    </Card>
  );
}

function UserTable({ users }: { users: AppUser[] }) {
  if (users.length === 0) return <Empty>No users yet.</Empty>;
  return (
    <table>
      <thead>
        <tr>
          <th>Name</th>
          <th>Email</th>
          <th>Role</th>
          <th>Last login</th>
        </tr>
      </thead>
      <tbody>
        {users.map((user) => (
          <tr key={user.uid}>
            <td>{user.name}</td>
            <td>{user.email}</td>
            <td><Status value={user.role} /></td>
            <td>{formatDateTime(user.lastLoginAt)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function StudentTable({ students }: { students: StudentProfile[] }) {
  if (students.length === 0) return <Empty>No student profiles.</Empty>;
  return (
    <table>
      <thead>
        <tr>
          <th>Name</th>
          <th>Program</th>
          <th>Industry</th>
          <th>Ready</th>
        </tr>
      </thead>
      <tbody>
        {students.map((student) => (
          <tr key={student.uid}>
            <td>{student.fullName}</td>
            <td>{student.program}</td>
            <td>{student.targetIndustry}</td>
            <td><Status value={student.resumeUrl && student.etiquetteCompleted ? "ready" : "incomplete"} /></td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function AlumniTable({ alumni }: { alumni: AlumniProfile[] }) {
  if (alumni.length === 0) return <Empty>No alumni profiles.</Empty>;
  return (
    <table>
      <thead>
        <tr>
          <th>Name</th>
          <th>Company</th>
          <th>Industry</th>
          <th>Status</th>
        </tr>
      </thead>
      <tbody>
        {alumni.map((person) => (
          <tr key={person.uid}>
            <td>{person.fullName}</td>
            <td>{person.company}</td>
            <td>{person.industry}</td>
            <td><Status value={person.isPublished ? "published" : "draft"} /></td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function BookingTable({ bookings, slots }: { bookings: Booking[]; slots: AvailabilitySlot[] }) {
  if (bookings.length === 0) return <Empty>No bookings.</Empty>;
  return (
    <table>
      <thead>
        <tr>
          <th>Student</th>
          <th>Alumni</th>
          <th>Session</th>
          <th>Status</th>
          <th>Reason</th>
        </tr>
      </thead>
      <tbody>
        {bookings.map((booking) => {
          const slot = slots.find((item) => item.slotId === booking.slotId);
          return (
            <tr key={booking.bookingId}>
              <td>{booking.studentId.slice(0, 8)}</td>
              <td>{booking.alumniId.slice(0, 8)}</td>
              <td>{slot ? `${trackLabels[slot.track]} - ${formatDateTime(slot.startTime)}` : booking.slotId}</td>
              <td><Status value={booking.status} /></td>
              <td>{booking.cancellationReason || "-"}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function InviteTable({ invites }: { invites: AdminInvite[] }) {
  return (
    <table>
      <thead>
        <tr>
          <th>Email</th>
          <th>Status</th>
          <th>Invited</th>
          <th>Expires</th>
        </tr>
      </thead>
      <tbody>
        {invites.map((invite) => (
          <tr key={invite.email}>
            <td>{invite.email}</td>
            <td><Status value={invite.status} /></td>
            <td>{formatDateTime(invite.createdAt)}</td>
            <td>{formatDateTime(invite.expiresAt)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
