-- New-domain signup approval gate. Purely additive — no existing row in either
-- table is read, updated, or deleted. Both columns are nullable with no
-- default, so any INSERT that doesn't mention them (i.e. every insert the old
-- domain's app already does) is completely unaffected.
--
-- approval_status: 'pending' | 'active' | 'declined' — set explicitly by the
-- new-domain webhook/admin-approval code. Deliberately a separate column from
-- the existing `is_active` (which already holds unexplained legacy values we
-- don't want to touch or rely on).
ALTER TABLE pype_voice_users ADD COLUMN IF NOT EXISTS approval_status text;

-- granted_via: 'new_domain' — tags a mapping row as created by the new-domain
-- approval flow, so new-domain access checks can tell it apart from a
-- pre-existing (old-domain) row that merely happens to share an email.
ALTER TABLE pype_voice_email_project_mapping ADD COLUMN IF NOT EXISTS granted_via text;
