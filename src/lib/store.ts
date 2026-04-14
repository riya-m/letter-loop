import { supabase } from './supabase';
import type {
  InvitedEmail,
  Loop,
  LoopPhase,
  PromptAnswer,
  Question,
  QuestionAnswer,
  SectionPrompt,
} from '../types';

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
  questionAnswers: QuestionAnswer[];
  sectionPrompts: SectionPrompt[];
  promptAnswers: PromptAnswer[];
  invitedUsers: InvitedEmail[];
}

export interface ManageLoopBundle {
  loop: Loop;
  invitedUsers: InvitedEmail[];
}

export interface UploadedImage {
  image_url: string;
  image_path: string;
  image_mime: string;
  image_size: number;
}

const normalizeEmail = (value: string) => value.trim().toLowerCase();

const FIXED_PROMPTS = [
  { key: 'announcements', title: 'Announcements', display_order: 1 },
  { key: 'shoutouts', title: 'Shout-outs', display_order: 2 },
  { key: 'mann_ki_baat', title: 'Mann-ki-baat', display_order: 3 },
] as const;

const IMAGE_BUCKET = 'loop-images';
const MAX_IMAGE_SIZE = 5 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

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

const ensureLoopPrompts = async (loopId: string): Promise<void> => {
  const { data, error } = await supabase.from('section_prompts').select('id').eq('loop_id', loopId).limit(1);
  if (error) {
    throw error;
  }

  if ((data ?? []).length > 0) {
    return;
  }

  const payload = FIXED_PROMPTS.map((prompt) => ({
    loop_id: loopId,
    key: prompt.key,
    title: prompt.title,
    display_order: prompt.display_order,
  }));

  const { error: insertError } = await supabase.from('section_prompts').insert(payload);
  if (insertError) {
    throw insertError;
  }
};

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

  await ensureLoopPrompts(data.id);
  return data.id;
};

export const fetchLoopBundle = async (loopId: string): Promise<LoopBundle> => {
  await ensureInvitedContext();
  await ensureLoopPrompts(loopId);

  const [loopResult, questionsResult, questionAnswersResult, sectionPromptsResult, promptAnswersResult, invitesResult] = await Promise.all([
    getLoopById(loopId),
    supabase.from('questions').select('id, loop_id, author_email, text, created_at').eq('loop_id', loopId).order('created_at', { ascending: true }),
    supabase
      .from('question_answers')
      .select('id, loop_id, question_id, author_email, text, image_url, image_path, image_mime, image_size, created_at')
      .eq('loop_id', loopId)
      .order('created_at', { ascending: true }),
    supabase
      .from('section_prompts')
      .select('id, loop_id, key, title, display_order, created_at')
      .eq('loop_id', loopId)
      .order('display_order', { ascending: true }),
    supabase
      .from('prompt_answers')
      .select('id, loop_id, prompt_id, author_email, text, image_url, image_path, image_mime, image_size, created_at')
      .eq('loop_id', loopId)
      .order('created_at', { ascending: true }),
    supabase
      .from('invited_emails')
      .select('email, active, is_admin, nickname, created_at')
      .eq('active', true)
      .order('email', { ascending: true }),
  ]);

  if (questionsResult.error) throw questionsResult.error;
  if (questionAnswersResult.error) throw questionAnswersResult.error;
  if (sectionPromptsResult.error) throw sectionPromptsResult.error;
  if (promptAnswersResult.error) throw promptAnswersResult.error;
  if (invitesResult.error) throw invitesResult.error;

  return {
    loop: loopResult,
    questions: (questionsResult.data ?? []) as Question[],
    questionAnswers: (questionAnswersResult.data ?? []) as QuestionAnswer[],
    sectionPrompts: (sectionPromptsResult.data ?? []) as SectionPrompt[],
    promptAnswers: (promptAnswersResult.data ?? []) as PromptAnswer[],
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

const ensureImageAllowed = (file: File) => {
  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
    throw new Error('Unsupported image type. Use jpg, png, webp, or gif.');
  }
  if (file.size > MAX_IMAGE_SIZE) {
    throw new Error('Image is too large. Max size is 5 MB.');
  }
};

export const uploadAnswerImage = async (loopId: string, file: File): Promise<UploadedImage> => {
  const ctx = await ensureInvitedContext();
  ensureImageAllowed(file);

  const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
  const path = `${loopId}/${ctx.email}/${crypto.randomUUID()}.${ext}`;

  const { error } = await supabase.storage.from(IMAGE_BUCKET).upload(path, file, {
    upsert: false,
    contentType: file.type,
  });

  if (error) {
    throw error;
  }

  const { data } = supabase.storage.from(IMAGE_BUCKET).getPublicUrl(path);
  return {
    image_url: data.publicUrl,
    image_path: path,
    image_mime: file.type,
    image_size: file.size,
  };
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

export const answerFixedPrompt = async (
  loopId: string,
  promptId: string,
  text: string,
  image?: UploadedImage,
): Promise<void> => {
  const ctx = await ensureInvitedContext();
  const loop = await getLoopById(loopId);
  if (loop.phase !== 2) {
    throw new Error('Responses can only be submitted in phase 2.');
  }

  const trimmed = text.trim();
  if (trimmed.length === 0 && !image) {
    throw new Error('Add some text or image before submitting.');
  }

  const { error } = await supabase.from('prompt_answers').insert({
    loop_id: loopId,
    prompt_id: promptId,
    author_email: ctx.email,
    text: trimmed,
    image_url: image?.image_url ?? null,
    image_path: image?.image_path ?? null,
    image_mime: image?.image_mime ?? null,
    image_size: image?.image_size ?? null,
  });

  if (error) {
    if (error.code === '23505') {
      throw new Error('You already answered this section.');
    }
    throw error;
  }
};

export const answerQuestion = async (
  loopId: string,
  questionId: string,
  text: string,
  image?: UploadedImage,
): Promise<void> => {
  const ctx = await ensureInvitedContext();
  const loop = await getLoopById(loopId);
  if (loop.phase !== 2) {
    throw new Error('Answers can only be added in phase 2.');
  }

  const trimmed = text.trim();
  if (trimmed.length === 0 && !image) {
    throw new Error('Add some text or image before submitting.');
  }

  const { error } = await supabase.from('question_answers').insert({
    loop_id: loopId,
    question_id: questionId,
    author_email: ctx.email,
    text: trimmed,
    image_url: image?.image_url ?? null,
    image_path: image?.image_path ?? null,
    image_mime: image?.image_mime ?? null,
    image_size: image?.image_size ?? null,
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
