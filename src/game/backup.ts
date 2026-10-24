/* ================================================================
   Automatic Save Recovery
   Keeps several rotating local backups of the profile. If a save
   becomes corrupted (or an import goes wrong) the newest valid
   backup is restored instead of wiping progress.
   ================================================================ */

import { sanitizeProfile, EMPTY_PROFILE, type Profile } from "./progression";

export const BACKUP_SLOTS = 4;
const BACKUP_PREFIX = "wwr-backup-v3-";

export interface BackupMeta {
  slot: number;
  savedAt: string;
  runs: number;
  wallet: number;
}

function slotKey(slot: number) {
  return `${BACKUP_PREFIX}${slot}`;
}

/**
 * Rotate backups: slot 0 is always the most recent write.
 * Call AFTER a successful saveProfile write.
 */
export function rotateBackups(current: Profile) {
  try {
    for (let i = BACKUP_SLOTS - 1; i > 0; i--) {
      const from = localStorage.getItem(slotKey(i - 1));
      if (from !== null) localStorage.setItem(slotKey(i), from);
    }
    localStorage.setItem(slotKey(0), JSON.stringify({ savedAt: new Date().toISOString(), profile: current }));
  } catch {
    /* storage full or blocked — the primary save still exists */
  }
}

/** Read a specific backup slot; null when missing or invalid. */
export function readBackup(slot: number): { savedAt: string; profile: Profile } | null {
  try {
    const raw = localStorage.getItem(slotKey(slot));
    if (!raw) return null;
    const data = JSON.parse(raw) as { savedAt?: unknown; profile?: unknown };
    if (typeof data.savedAt !== "string") return null;
    const p = sanitizeProfile(data.profile);
    // a valid backup must contain real progress, not an empty shell
    if (p.runs === 0 && p.xp === 0 && !p.ghost) return null;
    return { savedAt: data.savedAt, profile: p };
  } catch {
    return null;
  }
}

export function listBackups(): BackupMeta[] {
  const out: BackupMeta[] = [];
  for (let i = 0; i < BACKUP_SLOTS; i++) {
    const b = readBackup(i);
    if (b) out.push({ slot: i, savedAt: b.savedAt, runs: b.profile.runs, wallet: b.profile.wallet });
  }
  return out;
}

/**
 * Load with recovery: returns the profile plus how it was obtained so
 * the UI can surface "restored from backup" honestly.
 */
export function loadProfileWithRecovery(): { profile: Profile; recovered: boolean } {
  try {
    const raw = localStorage.getItem("wwr-profile-v3");
    if (raw) {
      const parsed = JSON.parse(raw);
      const p = sanitizeProfile(parsed);
      // A parsed-but-empty result while backups hold real progress means
      // the primary save was corrupted into an unusable shape.
      if (p.runs > 0 || p.xp > 0 || p.lifetimeCoins > 0 || p.ghost) {
        return { profile: p, recovered: false };
      }
    }
  } catch {
    /* fall through to backups */
  }
  for (let i = 0; i < BACKUP_SLOTS; i++) {
    const b = readBackup(i);
    if (b) return { profile: b.profile, recovered: true };
  }
  return { profile: structuredClone(EMPTY_PROFILE), recovered: false };
}

/** Restore a given slot and make it the primary save. */
export function restoreBackup(slot: number): Profile | null {
  const b = readBackup(slot);
  if (!b) return null;
  try {
    localStorage.setItem("wwr-profile-v3", JSON.stringify(b.profile));
  } catch {
    return null;
  }
  return b.profile;
}
