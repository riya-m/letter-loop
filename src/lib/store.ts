import { supabase } from './supabase';
import type { Answer, InvitedEmail, Loop, LoopPhase, Question } from '../types';

export interface UserContext {
  email: string;
  isAdmin: boolean;
}

export interface LoopDisplay {
  id: string;
  title: string;
  description: string | null;
  phase: LoopPhase;
  created_at: string;
  published_at: string | null;
  is_admin: boolean;
}

export interface LoopBundle {
  loop: Loop;
  questions: Question[];
  answers: Answer[];
  invitedUsers: InvitedEmail[];
}

export interface ManageLoopBundle {
  loop: Loop;
  invitedUsers: InvitedEmail[];
}

const normalizeEmail = (value: string) => value.trim().toLowerCase();

export const getSessionEmail = async (): Promise<string | null> => {
  const { data, error } = await supabase.auth.getUser();
  if (error) {
    throw error;
  }

  const email = data.user?.email;
  return email ? normalizeEmail(email) : null;
};

export const ensureInvitedContext = async (): Promise<UserContext> => {
  const email = await getSessionEmail();
  if (!email) {
    throw new Error('You must be logged in.');
  }

  const { data, error } = await supabase
    .from('invited_emails')
    .select('email, active, is_admin, nickname, created_at')
    .eq('email', email)
    .eq('active', true)
    .maybeSingle<InvitedEmail>();

  if (error) {
    throw error;
  }

  if (!data) {
    throw new Error('Your email is not invited.');
  }

  return {
    email,
    isAdmin: data.is_admin,
  };
};

export const getUserContext = async (): Promise<UserContext> => ensureInvitedContext();

export const listLoops = async (): Promise<LoopDisplay[]> => {
  const ctx = await ensureInvitedContext();

  const { data, error } = await supabase
    .from('loops')
    .select('id, title, description, phase, created_at, published_at, admin_email')
    .order('created_at', { ascending: false });

  if (error) {
    throw error;
  }

  return (data ?? []).map((loop) => ({
    id: loop.id,
    title: loop.title,
    description: loop.description,
    phase: loop.phase as LoopPhase,
    created_at: loop.created_at,
    published_at: loop.published_at,
    is_admin: normalizeEmail(loop.admin_email) === ctx.email,
  }));
};

export const createLoop = async (title: string, description: string): Promise<string> => {
  const ctx = await ensureInvitedContext();
  if (!ctx.isAdmin) {
    throw new Error('Only admins can create loops.');
  }

  const trimmedTitle = title.trim();
  const trimmedDescription = description.trim();

  const { data, error } = await supabase
    .from('loops')
    .insert({
      title: trimmedTitle,
      description: trimmedDescription.length > 0 ? trimmedDescription : null,
      phase: 1,
      admin_email: ctx.email,
    })
    .select('id')
    .single();

  if (error) {
    throw error;
  }

  return data.id;
};

const getLoopById = async (loopId: string): Promise<Loop> => {
  const { data, error } = await supabase
    .from('loops')
    .select('id, title, description, phase, admin_email, created_at, updated_at, published_at')
    .eq('id', loopId)
    .single<Loop>();

  if (error) {
    throw error;
  }

  return data;
};

export const fetchLoopBundle = async (loopId: string): Promise<LoopBundle> => {
  await ensureInvitedContext();

  const [loopResult, questionsResult, answersResult, invitesResult] = await Promise.all([
    getLoopById(loopId),
    supabase
      .from('questions')
      .select('id, loop_id, author_email, text, created_at')
      .eq('loop_id', loopId)
      .order('created_at', { ascending: true }),
    supabase
      .from('answers')
      .select('id, loop_id, question_id, author_email, text, created_at')
      .eq('loop_id', loopId)
      .order('created_at', { ascending: true }),
    supabase
      .from('invited_emails')
      .select('email, active, is_admin, nickname, created_at')
      .eq('active', true)
      .order('email', { ascending: true }),
  ]);

  const questionsError = questionsResult.error;
  const answersError = answersResult.error;
  const invitesError = invitesResult.error;

  if (questionsError) {
    throw questionsError;
  }
  if (answersError) {
    throw answersError;
  }
  if (invitesError) {
    throw invitesError;
  }

  return {
    loop: loopResult,
    questions: (questionsResult.data ?? []) as Question[],
    answers: (answersResult.data ?? []) as Answer[],
    invitedUsers: (invitesResult.data ?? []).map((row) => ({
      email: normalizeEmail(row.email),
      active: row.active,
      is_admin: row.is_admin,
      nickname: row.nickname,
      created_at: row.created_at,
    })),
  };
};

export const fetchManageLoopBundle = async (loopId: string): Promise<ManageLoopBundle> => {
  await ensureInvitedContext();

  const [loopResult, invitesResult] = await Promise.all([
    getLoopById(loopId),
    supabase
      .from('invited_emails')
      .select('email, active, is_admin, nickname, created_at')
      .eq('active', true)
      .order('email', { ascending: true }),
  ]);

  if (invitesResult.error) {
    throw invitesResult.error;
  }

  return {
    loop: loopResult,
    invitedUsers: (invitesResult.data ?? []).map((row) => ({
      email: normalizeEmail(row.email),
      active: row.active,
      is_admin: row.is_admin,
      nickname: row.nickname,
      created_at: row.created_at,
    })),
  };
};

export const setLoopPhase = async (loopId: string, nextPhase: LoopPhase): Promise<Loop> => {
  const ctx = await ensureInvitedContext();
  const current = await getLoopById(loopId);

  if (normalizeEmail(current.admin_email) !== ctx.email) {
    throw new Error('Only the loop admin can move phases.');
  }

  if (current.phase === 3) {
    throw new Error('Published loops are locked and cannot change phase.');
  }

  if (nextPhase !== current.phase + 1) {
    throw new Error('Loops can only move forward one phase at a time.');
  }

  const now = new Date().toISOString();
  const payload = nextPhase === 3 ? { phase: nextPhase, published_at: now } : { phase: nextPhase };

  const { data, error } = await supabase
    .from('loops')
    .update(payload)
    .eq('id', loopId)
    .select('id, title, description, phase, admin_email, created_at, updated_at, published_at')
    .single<Loop>();

  if (error) {
    throw error;
  }

  return data;
};

export const addQuestion = async (loopId: string, text: string): Promise<void> => {
  const ctx = await ensureInvitedContext();
  const loop = await getLoopById(loopId);

  if (loop.phase !== 1) {
    throw new Error('Questions can only be added in phase 1.');
  }

  const trimmed = text.trim();
  if (trimmed.length === 0) {
    throw new Error('Question cannot be empty.');
  }

  const { error } = await supabase.from('questions').insert({
    loop_id: loopId,
    author_email: ctx.email,
    text: trimmed,
  });

  if (error) {
    throw error;
  }
};

export const addAnswer = async (loopId: string, questionId: string, text: string): Promise<void> => {
  const ctx = await ensureInvitedContext();
  const loop = await getLoopById(loopId);

  if (loop.phase !== 2) {
    throw new Error('Answers can only be added in phase 2.');
  }

  const trimmed = text.trim();
  if (trimmed.length === 0) {
    throw new Error('Answer cannot be empty.');
  }

  const { error } = await supabase.from('answers').insert({
    loop_id: loopId,
    question_id: questionId,
    author_email: ctx.email,
    text: trimmed,
  });

  if (error) {
    if (error.code === '23505') {
      throw new Error('You already answered this question.');
    }
    throw error;
  }
};

export const saveNickname = async (targetEmail: string, nickname: string): Promise<void> => {
  const ctx = await ensureInvitedContext();

  if (!ctx.isAdmin) {
    throw new Error('Only admins can edit nicknames.');
  }

  const email = normalizeEmail(targetEmail);
  const trimmedNickname = nickname.trim();

  if (trimmedNickname.length === 0) {
    throw new Error('Nickname cannot be empty.');
  }

  const { error } = await supabase.from('invited_emails').update({ nickname: trimmedNickname }).eq('email', email);

  if (error) {
    throw error;
  }
};

export const getDisplayName = (email: string, nicknameMap: Record<string, string>): string => {
  const normalized = normalizeEmail(email);
  const fromNickname = nicknameMap[normalized];
  if (fromNickname && fromNickname.trim().length > 0) {
    return fromNickname;
  }

  const localPart = normalized.split('@')[0];
  return localPart || normalized;
};

export const buildNicknameMap = (invitedUsers: InvitedEmail[]): Record<string, string> => {
  return invitedUsers.reduce<Record<string, string>>((acc, user) => {
    if (user.nickname && user.nickname.trim().length > 0) {
      acc[normalizeEmail(user.email)] = user.nickname;
    }
    return acc;
  }, {});
};
