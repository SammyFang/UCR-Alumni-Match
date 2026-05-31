const admin = require("firebase-admin");
const crypto = require("crypto");
const { HttpsError, onCall } = require("firebase-functions/v2/https");
const { setGlobalOptions } = require("firebase-functions/v2");

admin.initializeApp();
setGlobalOptions({ region: "us-central1", maxInstances: 10 });

const db = admin.firestore();
const FieldValue = admin.firestore.FieldValue;

const ACTIVE_STATUS = "confirmed";
const TRACKS = new Set(["mockInterview", "resumeReview", "careerChat", "industryConversation"]);
const SUPER_ADMIN_EMAIL = "yfang097@ucr.edu";
const APP_URL = process.env.APP_URL || "https://ucr-alu.web.app";

function requireAuth(request) {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Sign in is required.");
  }
  return request.auth.uid;
}

function normalizeEmail(value) {
  if (typeof value !== "string") {
    throw new HttpsError("invalid-argument", "Email is required.");
  }

  const email = value.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
    throw new HttpsError("invalid-argument", "Email is invalid.");
  }
  return email;
}

function requireSuperAdmin(request) {
  requireAuth(request);
  const email = request.auth.token.email?.toLowerCase();
  if (email !== SUPER_ADMIN_EMAIL) {
    throw new HttpsError("permission-denied", "Only the primary admin can send admin invitations.");
  }
}

function tokenHash(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function adminInviteEmail({ inviteeEmail, inviterEmail, inviteUrl }) {
  const safeInvitee = escapeHtml(inviteeEmail);
  const safeInviter = escapeHtml(inviterEmail);
  const safeUrl = escapeHtml(inviteUrl);

  return {
    subject: "Admin invitation to ALU Career Match",
    text: [
      "You have been invited to help manage ALU Career Match.",
      `Invited email: ${inviteeEmail}`,
      `Invited by: ${inviterEmail}`,
      `Accept invitation: ${inviteUrl}`,
      "This invitation expires in 7 days."
    ].join("\n\n"),
    html: `<!doctype html>
<html>
  <body style="margin:0;background:#f5f7fb;font-family:Inter,Segoe UI,Arial,sans-serif;color:#172033;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f5f7fb;padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#ffffff;border:1px solid #dce3ef;border-radius:12px;overflow:hidden;box-shadow:0 14px 34px rgba(20,31,54,.08);">
            <tr>
              <td style="padding:28px 30px 18px;">
                <div style="font-size:14px;font-weight:700;color:#2454d6;letter-spacing:.02em;">ALU Career Match</div>
                <h1 style="margin:14px 0 8px;font-size:26px;line-height:1.2;color:#141b2d;">Admin invitation</h1>
                <p style="margin:0;color:#667489;font-size:15px;line-height:1.6;">${safeInviter} invited ${safeInvitee} to help manage student, alumni, booking, and flagged cancellation records.</p>
              </td>
            </tr>
            <tr>
              <td style="padding:8px 30px 24px;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f8fafd;border:1px solid #e3e9f3;border-radius:10px;">
                  <tr>
                    <td style="padding:16px 18px;">
                      <div style="font-size:12px;color:#667489;text-transform:uppercase;font-weight:700;">Invited account</div>
                      <div style="margin-top:5px;font-size:16px;font-weight:700;color:#141b2d;">${safeInvitee}</div>
                    </td>
                  </tr>
                </table>
                <a href="${safeUrl}" style="display:block;margin:22px 0 14px;background:#2454d6;color:#ffffff;text-decoration:none;text-align:center;font-size:15px;font-weight:800;padding:13px 18px;border-radius:8px;">Accept admin access</a>
                <p style="margin:0;color:#667489;font-size:13px;line-height:1.6;">Use the invited email address when signing in. This invitation expires in 7 days.</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`
  };
}

function requireString(value, field, max = 500) {
  if (typeof value !== "string" || value.trim().length === 0 || value.length > max) {
    throw new HttpsError("invalid-argument", `${field} is invalid.`);
  }
  return value.trim();
}

function normalizeGoals(value) {
  if (!Array.isArray(value)) {
    throw new HttpsError("invalid-argument", "Session goals are required.");
  }

  const goals = value
    .map((goal) => (typeof goal === "string" ? goal.trim() : ""))
    .filter(Boolean)
    .slice(0, 5);

  if (goals.length === 0 || goals.some((goal) => goal.length > 120)) {
    throw new HttpsError("invalid-argument", "Session goals are invalid.");
  }

  return goals;
}

function timestampMillis(value) {
  if (!value || typeof value.toMillis !== "function") {
    throw new HttpsError("failed-precondition", "Slot time is invalid.");
  }
  return value.toMillis();
}

function overlaps(aStart, aEnd, bStart, bEnd) {
  return aStart < bEnd && bStart < aEnd;
}

async function requireStudent(transaction, uid) {
  const userRef = db.collection("users").doc(uid);
  const profileRef = db.collection("studentProfiles").doc(uid);
  const [userSnap, profileSnap] = await transaction.getAll(userRef, profileRef);

  if (!userSnap.exists || userSnap.data().role !== "student") {
    throw new HttpsError("permission-denied", "Student account is required.");
  }

  if (!profileSnap.exists) {
    throw new HttpsError("failed-precondition", "Complete your student profile first.");
  }

  const profile = profileSnap.data();
  const required = ["fullName", "program", "targetIndustry"];
  const missingRequired = required.some((field) => !profile[field]);

  if (missingRequired || !Array.isArray(profile.careerInterests) || profile.careerInterests.length === 0) {
    throw new HttpsError("failed-precondition", "Complete your student profile first.");
  }

  if (!profile.resumeUrl) {
    throw new HttpsError("failed-precondition", "Upload a resume before booking.");
  }

  if (profile.etiquetteCompleted !== true) {
    throw new HttpsError("failed-precondition", "Complete the etiquette checklist before booking.");
  }

  return profile;
}

exports.sendAdminInvite = onCall(async (request) => {
  requireSuperAdmin(request);
  const inviteeEmail = normalizeEmail(request.data?.email);
  const inviterEmail = request.auth.token.email.toLowerCase();
  const token = crypto.randomBytes(32).toString("base64url");
  const expiresAt = admin.firestore.Timestamp.fromMillis(Date.now() + 7 * 24 * 60 * 60 * 1000);
  const inviteUrl = `${APP_URL}/admin/accept-invite?email=${encodeURIComponent(inviteeEmail)}&token=${encodeURIComponent(token)}`;
  const inviteRef = db.collection("adminInvites").doc(inviteeEmail);
  const mailRef = db.collection("mail").doc();
  const emailMessage = adminInviteEmail({ inviteeEmail, inviterEmail, inviteUrl });

  await db.runTransaction(async (transaction) => {
    const inviteSnap = await transaction.get(inviteRef);
    if (inviteSnap.exists && inviteSnap.data().status === "accepted") {
      throw new HttpsError("failed-precondition", "This admin invitation has already been accepted.");
    }

    transaction.set(inviteRef, {
      email: inviteeEmail,
      invitedBy: request.auth.uid,
      invitedByEmail: inviterEmail,
      status: "pending",
      tokenHash: tokenHash(token),
      inviteUrl,
      createdAt: inviteSnap.exists ? inviteSnap.data().createdAt : FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
      expiresAt
    }, { merge: true });

    transaction.create(mailRef, {
      to: inviteeEmail,
      message: emailMessage,
      createdAt: FieldValue.serverTimestamp(),
      metadata: {
        type: "adminInvite",
        inviteeEmail,
        invitedBy: request.auth.uid
      }
    });
  });

  return { email: inviteeEmail, status: "pending" };
});

exports.acceptAdminInvite = onCall(async (request) => {
  const uid = requireAuth(request);
  const inviteeEmail = normalizeEmail(request.data?.email);
  const token = requireString(request.data?.token, "token", 300);
  const authEmail = request.auth.token.email?.toLowerCase();

  if (authEmail !== inviteeEmail) {
    throw new HttpsError("permission-denied", "Sign in with the invited email address.");
  }

  const inviteRef = db.collection("adminInvites").doc(inviteeEmail);
  const userRef = db.collection("users").doc(uid);
  const authName = request.auth.token.name || inviteeEmail.split("@")[0];
  const authPhoto = request.auth.token.picture || null;

  await db.runTransaction(async (transaction) => {
    const inviteSnap = await transaction.get(inviteRef);
    const userSnap = await transaction.get(userRef);

    if (!inviteSnap.exists) {
      throw new HttpsError("not-found", "Invitation was not found.");
    }

    const invite = inviteSnap.data();
    if (invite.status === "revoked") {
      throw new HttpsError("permission-denied", "Invitation has been revoked.");
    }

    if (invite.expiresAt?.toMillis() < Date.now()) {
      throw new HttpsError("deadline-exceeded", "Invitation has expired.");
    }

    if (invite.tokenHash !== tokenHash(token)) {
      throw new HttpsError("permission-denied", "Invitation token is invalid.");
    }

    transaction.set(userRef, {
      uid,
      role: "admin",
      name: userSnap.exists ? userSnap.data().name : authName,
      email: inviteeEmail,
      photoURL: userSnap.exists ? (userSnap.data().photoURL || authPhoto) : authPhoto,
      createdAt: userSnap.exists ? userSnap.data().createdAt : FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
      lastLoginAt: FieldValue.serverTimestamp()
    }, { merge: true });

    transaction.update(inviteRef, {
      status: "accepted",
      acceptedAt: FieldValue.serverTimestamp(),
      acceptedByUid: uid,
      updatedAt: FieldValue.serverTimestamp()
    });
  });

  return { email: inviteeEmail, status: "accepted" };
});

exports.bookSlot = onCall(async (request) => {
  const uid = requireAuth(request);
  const slotId = requireString(request.data?.slotId, "slotId", 160);
  const sessionGoals = normalizeGoals(request.data?.sessionGoals);
  const now = Date.now();

  return db.runTransaction(async (transaction) => {
    const studentProfile = await requireStudent(transaction, uid);
    const slotRef = db.collection("availabilitySlots").doc(slotId);
    const slotSnap = await transaction.get(slotRef);

    if (!slotSnap.exists) {
      throw new HttpsError("not-found", "Slot was not found.");
    }

    const slot = slotSnap.data();
    if (slot.status !== "available") {
      throw new HttpsError("failed-precondition", "Slot is no longer available.");
    }

    if (!TRACKS.has(slot.track)) {
      throw new HttpsError("failed-precondition", "Slot track is invalid.");
    }

    const slotStart = timestampMillis(slot.startTime);
    const slotEnd = timestampMillis(slot.endTime);

    if (slotStart <= now || slotEnd <= slotStart) {
      throw new HttpsError("failed-precondition", "Slot time is no longer valid.");
    }

    const alumniRef = db.collection("alumniProfiles").doc(slot.alumniId);
    const alumniSnap = await transaction.get(alumniRef);
    if (!alumniSnap.exists || alumniSnap.data().isPublished !== true) {
      throw new HttpsError("failed-precondition", "Alumni profile is not published.");
    }

    const activeQuery = db
      .collection("bookings")
      .where("studentId", "==", uid)
      .where("status", "==", ACTIVE_STATUS);
    const activeSnap = await transaction.get(activeQuery);

    if (activeSnap.size >= 2) {
      throw new HttpsError("failed-precondition", "You can hold up to 2 active bookings.");
    }

    for (const bookingDoc of activeSnap.docs) {
      const activeSlotId = bookingDoc.data().slotId;
      if (!activeSlotId) continue;

      const activeSlotSnap = await transaction.get(db.collection("availabilitySlots").doc(activeSlotId));
      if (!activeSlotSnap.exists) continue;

      const activeSlot = activeSlotSnap.data();
      const activeStart = timestampMillis(activeSlot.startTime);
      const activeEnd = timestampMillis(activeSlot.endTime);
      if (overlaps(slotStart, slotEnd, activeStart, activeEnd)) {
        throw new HttpsError("failed-precondition", "This booking overlaps an active session.");
      }
    }

    const bookingRef = db.collection("bookings").doc();
    transaction.create(bookingRef, {
      bookingId: bookingRef.id,
      studentId: uid,
      alumniId: slot.alumniId,
      slotId,
      resumeUrl: studentProfile.resumeUrl,
      sessionGoals,
      status: ACTIVE_STATUS,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp()
    });

    transaction.update(slotRef, {
      status: "booked",
      updatedAt: FieldValue.serverTimestamp()
    });

    return { bookingId: bookingRef.id, status: ACTIVE_STATUS };
  });
});

exports.cancelBooking = onCall(async (request) => {
  const uid = requireAuth(request);
  const bookingId = requireString(request.data?.bookingId, "bookingId", 160);
  const cancellationReason =
    typeof request.data?.cancellationReason === "string"
      ? request.data.cancellationReason.trim().slice(0, 500)
      : "";

  return db.runTransaction(async (transaction) => {
    const bookingRef = db.collection("bookings").doc(bookingId);
    const bookingSnap = await transaction.get(bookingRef);

    if (!bookingSnap.exists) {
      throw new HttpsError("not-found", "Booking was not found.");
    }

    const booking = bookingSnap.data();
    if (booking.studentId !== uid) {
      throw new HttpsError("permission-denied", "Only the booking student can cancel this session.");
    }

    if (booking.status !== ACTIVE_STATUS) {
      throw new HttpsError("failed-precondition", "Booking is not active.");
    }

    const slotRef = db.collection("availabilitySlots").doc(booking.slotId);
    const slotSnap = await transaction.get(slotRef);
    if (!slotSnap.exists) {
      throw new HttpsError("failed-precondition", "Linked slot was not found.");
    }

    const slot = slotSnap.data();
    const startTime = timestampMillis(slot.startTime);
    const isLateCancellation = startTime - Date.now() <= 24 * 60 * 60 * 1000;
    const nextStatus = isLateCancellation ? "flagged" : "cancelled";

    transaction.update(bookingRef, {
      status: nextStatus,
      cancellationReason,
      updatedAt: FieldValue.serverTimestamp()
    });

    transaction.update(slotRef, {
      status: isLateCancellation ? "cancelled" : "available",
      updatedAt: FieldValue.serverTimestamp()
    });

    return { bookingId, status: nextStatus };
  });
});
