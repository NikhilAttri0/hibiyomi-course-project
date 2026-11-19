'use client';

/**
 * Typed client for the app's own API (src/app/api/**). The server checks the signed-in
 * user's role on every request, so a teacher can only ever load batches assigned to them.
 */

import { apiFetch, type Profile, type Role } from '@/lib/auth';
import type { PersistedState, ProgressSummary } from '@/lib/learn-store';

export interface Batch {
  id: string;
  name: string;
  level: string;
  term: string | null;
  join_code: string;
  created_at: string;
}

export interface StudentRow {
  profile: Profile;
  joined_at: string;
  summary: (ProgressSummary & { updated_at: string }) | null;
}

export interface ReviewEventRow {
  id: number;
  student_id: string;
  kanji: string;
  kind: 'card' | 'quiz';
  grade: string | null;
  mode: string | null;
  correct: boolean;
  created_at: string;
}

/* ----------------------------- Student ----------------------------- */

export async function loadMyState(_userId: string): Promise<PersistedState | null> {
  const { state } = await apiFetch<{ state: PersistedState | null }>('/api/me/state');
  return state;
}

export async function saveMyState(_userId: string, state: PersistedState, summary: ProgressSummary) {
  await apiFetch('/api/me/state', { method: 'PUT', body: { state, summary } });
}

export function logReviewEvent(_userId: string, e: { kanji: string; kind: 'card' | 'quiz'; grade?: string; mode?: string; correct: boolean }) {
  void apiFetch('/api/me/events', { method: 'POST', body: e }).catch(() => undefined);
}

export async function joinBatch(code: string): Promise<string> {
  const { name } = await apiFetch<{ name: string }>('/api/me/batches', { method: 'POST', body: { code } });
  return name;
}

export async function myBatches(_userId: string): Promise<(Batch & { teachers: string[] })[]> {
  const { batches } = await apiFetch<{ batches: (Batch & { teachers: string[] })[] }>('/api/me/batches');
  return batches;
}

export async function leaveBatch(_userId: string, batchId: string) {
  await apiFetch(`/api/me/batches?batchId=${encodeURIComponent(batchId)}`, { method: 'DELETE' });
}

/* ----------------------------- Teacher ----------------------------- */

/** Batches visible to the caller: assigned batches for teachers, every batch for admins. */
export async function teachingBatches(_userId: string, _role: Role): Promise<Batch[]> {
  const { batches } = await apiFetch<{ batches: Batch[] }>('/api/teacher/batches');
  return batches;
}

export interface BatchDetail {
  batch: Batch;
  students: StudentRow[];
  states: Record<string, PersistedState>;
  events: ReviewEventRow[];
}

export async function batchDetail(batchId: string): Promise<BatchDetail> {
  return apiFetch<BatchDetail>(`/api/teacher/batches/${encodeURIComponent(batchId)}`);
}

/* ------------------------------ Admin ------------------------------ */

export type OrgRole = 'owner' | 'admin' | 'teacher' | 'student';
export interface Org {
  id: string;
  name: string;
  slug: string;
  kind: 'institution' | 'self';
  created_at: string;
  students: number;
  staff: number;
  batches: number;
}
export interface AdminOverview {
  me: { id: string; platformAdmin: boolean };
  orgs: Org[];
  batches: (Batch & { org_id: string | null })[];
  people: Profile[];
  members: { org_id: string; user_id: string; role: OrgRole }[];
  links: { batch_id: string; teacher_id: string }[];
  counts: Record<string, number>;
}

export async function adminOverview(): Promise<AdminOverview> {
  return apiFetch<AdminOverview>('/api/admin/overview');
}

export async function batchStudents(batchId: string): Promise<StudentRow[]> {
  const { students } = await apiFetch<{ students: StudentRow[] }>(`/api/admin/batches/${encodeURIComponent(batchId)}/students`);
  return students;
}

export async function createBatch(input: { name: string; level: string; term?: string; orgId?: string }, _userId: string): Promise<Batch> {
  const { batch } = await apiFetch<{ batch: Batch }>('/api/admin/batches', { method: 'POST', body: input });
  return batch;
}

export async function regenerateCode(batch: Batch): Promise<string> {
  const { batch: b } = await apiFetch<{ batch: Batch }>(`/api/admin/batches/${batch.id}`, { method: 'PATCH', body: { regenerate: true } });
  return b.join_code;
}

export async function deleteBatch(id: string) {
  await apiFetch(`/api/admin/batches/${id}`, { method: 'DELETE' });
}

export async function assignTeacher(batchId: string, teacherId: string) {
  await apiFetch(`/api/admin/batches/${batchId}/teachers`, { method: 'POST', body: { teacherId } });
}

export async function unassignTeacher(batchId: string, teacherId: string) {
  await apiFetch(`/api/admin/batches/${batchId}/teachers?teacherId=${encodeURIComponent(teacherId)}`, { method: 'DELETE' });
}

export async function removeStudent(batchId: string, studentId: string) {
  await apiFetch(`/api/admin/batches/${batchId}/students?studentId=${encodeURIComponent(studentId)}`, { method: 'DELETE' });
}

export async function addStudentToBatch(batchId: string, studentId: string) {
  await apiFetch(`/api/admin/batches/${batchId}/students`, { method: 'POST', body: { studentId } });
}

/** Role inside one institution (student / teacher / admin). */
export async function setOrgRole(userId: string, orgId: string, orgRole: Exclude<OrgRole, 'owner'>) {
  await apiFetch('/api/admin/users', { method: 'PATCH', body: { userId, orgId, orgRole } });
}

/** Platform admin only: make or unmake a platform admin. */
export async function setPlatformAdmin(userId: string, platformAdmin: boolean) {
  await apiFetch('/api/admin/users', { method: 'PATCH', body: { userId, platformAdmin } });
}

/** Remove someone from an institution; they keep their account and progress. */
export async function removeFromOrg(userId: string, orgId: string) {
  await apiFetch(`/api/admin/users?userId=${encodeURIComponent(userId)}&orgId=${encodeURIComponent(orgId)}`, { method: 'DELETE' });
}

export async function createOrg(input: { name: string; ownerEmail?: string; ownerName?: string }) {
  return apiFetch<{ org: Org; owner: { userId: string; tempPassword?: string } | null }>('/api/admin/orgs', { method: 'POST', body: input });
}

export async function renameOrg(id: string, name: string) {
  await apiFetch(`/api/admin/orgs/${id}`, { method: 'PATCH', body: { name } });
}

export async function deleteOrg(id: string) {
  await apiFetch(`/api/admin/orgs/${id}`, { method: 'DELETE' });
}

export async function resetPassword(userId: string): Promise<{ tempPassword: string }> {
  return apiFetch('/api/admin/users', { method: 'PATCH', body: { userId, resetPassword: true } });
}

export async function createAccount(input: {
  email: string;
  fullName: string;
  orgRole: Exclude<OrgRole, 'owner'>;
  orgId?: string;
  platformAdmin?: boolean;
}): Promise<{ tempPassword?: string; existing?: boolean }> {
  return apiFetch('/api/admin/users', { method: 'POST', body: input });
}

export async function updateMe(input: { fullName?: string; currentPassword?: string; newPassword?: string }) {
  return apiFetch<{ user: Profile }>('/api/auth/me', { method: 'PATCH', body: input });
}

export async function getAdminSettings(): Promise<{ signupRequiresCode: boolean }> {
  return apiFetch('/api/admin/settings');
}

export async function setSignupRequiresCode(on: boolean): Promise<{ signupRequiresCode: boolean }> {
  return apiFetch('/api/admin/settings', { method: 'PATCH', body: { signupRequiresCode: on } });
}
