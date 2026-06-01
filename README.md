# ALU Career Match

Lightweight Firebase MVP for alumni-student career matching. The app uses Firebase Authentication, Firestore, Storage, Hosting, and callable Functions for secure booking actions.

## Firebase Project Setup

1. Create or select a Firebase project.
2. Enable Authentication providers:
   - Google
   - Email/Password
3. Create a Firestore database in Native mode.
4. Enable Firebase Storage and create the default bucket.
5. Enable Firebase Hosting.
6. Upgrade to Blaze before deploying Functions. The `bookSlot` and `cancelBooking` callables enforce booking limits, overlap checks, slot locking, and late-cancellation flags.

## Account Policy

- Students must sign in with a verified `@ucr.edu` email address. Personal email accounts cannot select the student role or book sessions.
- Student name, email, and photo come from Firebase Authentication. Program, target industry, interests, resume, and etiquette are still completed by the student because this MVP intentionally does not use Institutional SSO or SIS data sync.
- Alumni can use their preferred email address.
- Admin access remains invite-only, with invitations controlled by `yfang097@ucr.edu`.

## Environment Variables

Copy `.env.example` to `.env.local` and set:

```bash
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
VITE_FIREBASE_MEASUREMENT_ID=
```

Do not commit real Firebase API keys or production config values. Keep them in `.env.local`, Firebase Hosting build environment, or your CI secret store.

If a Firebase web API key is exposed in GitHub, rotate it in Google Cloud Console, restrict the replacement key to the app's allowed domains, review API key usage logs, and close the GitHub alert only after the leaked key is revoked.

## Firestore Collections

- `users/{uid}`: role, name, email, photo, login timestamps.
- `studentProfiles/{uid}`: UCR email, student program, target industry, interests, resume URL, etiquette status.
- `alumniProfiles/{uid}`: alumni title, company, industry, support areas, LinkedIn URL, published status.
- `availabilitySlots/{slotId}`: alumni-owned open, booked, or cancelled time slots.
- `bookings/{bookingId}`: confirmed, cancelled, completed, or flagged sessions.
- `etiquetteChecklist/{uid}`: required student pre-booking checklist.
- `adminInvites/{email}`: admin invitation status and token metadata.

## Storage Paths

- `resumes/{uid}/{fileName}` for student resumes.
- `profilePhotos/{uid}/{fileName}` for alumni profile photos.

## Local Development

```bash
npm install
npm --prefix functions install
npm run dev
```

On Windows PowerShell systems that block npm scripts, use `npm.cmd`:

```powershell
npm.cmd install
npm.cmd --prefix functions install
npm.cmd run dev
```

## Deployment

```bash
npm run build
firebase deploy --project ucr-alu
```

For partial deploys:

```bash
firebase deploy --only hosting --project ucr-alu
firebase deploy --only firestore:rules --project ucr-alu
firebase deploy --only storage --project ucr-alu
firebase deploy --only functions --project ucr-alu
```

## Admin User

Admin is not self-service. The primary admin is fixed to:

```text
yfang097@ucr.edu
```

Primary admin flow:

1. Sign in with `yfang097@ucr.edu`.
2. Select `Admin` during role selection.
3. Open `/admin/invites`.
4. Enter a new admin email and send the invite.

Invited admin flow:

1. The invited user opens the email link.
2. The user signs in with the same invited email.
3. The invite link activates admin access and opens the admin dashboard.

Only `yfang097@ucr.edu` can send admin invitations. Invited admins can co-manage users, profiles, bookings, and flagged cancellations, but they cannot invite more admins.

## Admin Invitation Email

The `sendAdminInvite` callable creates:

- `adminInvites/{email}` with a hashed invitation token.
- `mail/{mailId}` with a polished HTML email payload.

Install and configure the Firebase Trigger Email extension to send documents from the `mail` collection. The expected document shape is:

```js
{
  to: "new-admin@example.com",
  message: {
    subject: "Admin invitation to ALU Career Match",
    html: "...",
    text: "..."
  }
}
```

Set `APP_URL` for Functions if the hosted URL changes. The default is `https://ucr-alu.web.app`.

## Intentional Removals

Removed from the previous concept:

- LinkedIn Login and LinkedIn OAuth.
- LinkedIn API import, token storage, profile sync, and monthly background sync.
- Institutional SSO. Students are instead restricted to `@ucr.edu` email accounts for reliable admin tracking.
- External calendar integrations.
- Advanced analytics dashboards, donut charts, competency rings, badges, and gamification.
- Complex enterprise onboarding and three-column dashboards.

LinkedIn remains only as a manually entered profile URL field with URL validation.
