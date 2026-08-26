import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { ApiError } from "../api/client";
import { primaryButtonBase } from "../lib/ui";

export function AccountPage() {
  const { user, updateProfile, changePassword, deactivateAccount } = useAuth();
  const navigate = useNavigate();

  const [name, setName] = useState(user?.name ?? "");
  const [email, setEmail] = useState(user?.email ?? "");
  const [emailNotificationsEnabled, setEmailNotificationsEnabled] = useState(user?.emailNotificationsEnabled ?? true);
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileMessage, setProfileMessage] = useState<string | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  const [confirmingDeactivate, setConfirmingDeactivate] = useState(false);
  const [deactivating, setDeactivating] = useState(false);
  const [deactivateError, setDeactivateError] = useState<string | null>(null);

  if (!user) return null;

  async function handleProfileSubmit(e: FormEvent) {
    e.preventDefault();
    setProfileError(null);
    setProfileMessage(null);
    setProfileSaving(true);
    try {
      await updateProfile({ name, email, emailNotificationsEnabled });
      setProfileMessage("Profile updated.");
    } catch (err) {
      setProfileError(err instanceof ApiError ? err.message : "Could not update profile.");
    } finally {
      setProfileSaving(false);
    }
  }

  async function handlePasswordSubmit(e: FormEvent) {
    e.preventDefault();
    setPasswordError(null);
    setPasswordMessage(null);
    if (newPassword !== confirmPassword) {
      setPasswordError("New password and confirmation don't match.");
      return;
    }
    setPasswordSaving(true);
    try {
      await changePassword({ currentPassword, newPassword });
      setPasswordMessage("Password changed.");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      setPasswordError(err instanceof ApiError ? err.message : "Could not change password.");
    } finally {
      setPasswordSaving(false);
    }
  }

  async function handleDeactivate() {
    setDeactivateError(null);
    setDeactivating(true);
    try {
      await deactivateAccount();
      navigate("/login");
    } catch (err) {
      setDeactivateError(err instanceof ApiError ? err.message : "Could not deactivate account.");
      setDeactivating(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Account</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">Manage your profile, password, and account status.</p>
      </div>

      <form onSubmit={handleProfileSubmit} className="space-y-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Profile</h2>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Name</label>
          <input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 px-3 py-2 text-sm focus:border-slate-500 dark:focus:border-slate-400 focus:outline-none"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Email</label>
          <input
            required
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 px-3 py-2 text-sm focus:border-slate-500 dark:focus:border-slate-400 focus:outline-none"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Role</label>
          <p className="text-sm text-slate-500 dark:text-slate-400">{user.role.replace("_", " ")} — only an Admin can change this.</p>
        </div>
        <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
          <input
            type="checkbox"
            checked={emailNotificationsEnabled}
            onChange={(e) => setEmailNotificationsEnabled(e.target.checked)}
          />
          Email me for notifications (in-app notifications always stay on)
        </label>
        {profileError && <p className="text-sm text-red-600">{profileError}</p>}
        {profileMessage && <p className="text-sm text-emerald-600">{profileMessage}</p>}
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={profileSaving}
            className={`${primaryButtonBase} px-4 py-2 text-sm`}
          >
            {profileSaving ? "Saving..." : "Save Profile"}
          </button>
        </div>
      </form>

      <form onSubmit={handlePasswordSubmit} className="space-y-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Change Password</h2>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Current Password</label>
          <input
            required
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            className="w-full rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 px-3 py-2 text-sm focus:border-slate-500 dark:focus:border-slate-400 focus:outline-none"
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">New Password</label>
            <input
              required
              type="password"
              minLength={8}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 px-3 py-2 text-sm focus:border-slate-500 dark:focus:border-slate-400 focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Confirm New Password</label>
            <input
              required
              type="password"
              minLength={8}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 px-3 py-2 text-sm focus:border-slate-500 dark:focus:border-slate-400 focus:outline-none"
            />
          </div>
        </div>
        <p className="text-xs text-slate-400 dark:text-slate-500">At least 8 characters.</p>
        {passwordError && <p className="text-sm text-red-600">{passwordError}</p>}
        {passwordMessage && <p className="text-sm text-emerald-600">{passwordMessage}</p>}
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={passwordSaving}
            className={`${primaryButtonBase} px-4 py-2 text-sm`}
          >
            {passwordSaving ? "Saving..." : "Change Password"}
          </button>
        </div>
      </form>

      <div className="space-y-3 rounded-xl border border-red-200 bg-red-50 p-6">
        <h2 className="text-sm font-semibold text-red-900">Danger Zone</h2>
        <p className="text-sm text-red-800">
          Deactivating your account signs you out and prevents further logins immediately. Historical records tied to
          your account — audit trail entries, risk assessments you ran, work papers you reviewed, documents you
          uploaded — are preserved and stay attributed to you, as required for governance and compliance evidence.
          This isn't reversible from here; an Admin can reactivate the account if needed.
        </p>
        {deactivateError && <p className="text-sm font-medium text-red-900">{deactivateError}</p>}
        {!confirmingDeactivate ? (
          <button
            onClick={() => setConfirmingDeactivate(true)}
            className="rounded-md border border-red-300 bg-white dark:bg-slate-900 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-100"
          >
            Deactivate My Account
          </button>
        ) : (
          <div className="flex items-center gap-3">
            <button
              onClick={handleDeactivate}
              disabled={deactivating}
              className="rounded-md bg-red-700 px-4 py-2 text-sm font-medium text-white hover:bg-red-800 disabled:opacity-50"
            >
              {deactivating ? "Deactivating..." : "Yes, deactivate my account"}
            </button>
            <button
              onClick={() => setConfirmingDeactivate(false)}
              className="text-sm font-medium text-red-700 hover:underline"
            >
              Cancel
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
