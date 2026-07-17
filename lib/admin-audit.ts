// Writes admin actions to admin_audit_log (migration 028).
//
// Never throws and never blocks the action it is recording. A failure to log
// must not turn a successful account deletion into an error the admin retries.
// If the table is missing (migration unapplied), this quietly no-ops.

interface AuditEntry {
  actorUserId?: string | null
  actorEmail?: string | null
  action: string
  targetUserId?: string | null
  targetEmail?: string | null
  detail?: Record<string, any>
  ok?: boolean
}

export async function auditLog(admin: any, entry: AuditEntry): Promise<void> {
  try {
    await admin.from('admin_audit_log').insert({
      actor_user_id: entry.actorUserId ?? null,
      actor_email: entry.actorEmail ?? null,
      action: entry.action,
      target_user_id: entry.targetUserId ?? null,
      target_email: entry.targetEmail ?? null,
      detail: entry.detail ?? {},
      ok: entry.ok ?? true,
    })
  } catch (e) {
    // Deliberately swallowed. The action already happened; losing its log
    // entry is bad, but failing the request afterwards would be worse and
    // would tempt a retry of something destructive.
    console.error('audit log write failed:', e)
  }
}
