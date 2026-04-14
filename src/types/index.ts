export type LoopPhase = 1 | 2 | 3;

export interface InvitedEmail {
  email: string;
  active: boolean;
  is_admin: boolean;
  nickname: string | null;
  created_at: string;
}

export interface Loop {
  id: string;
  title: string;
  description: string | null;
  phase: LoopPhase;
  admin_email: string;
  created_at: string;
  updated_at: string;
  published_at: string | null;
}

export interface Question {
  id: string;
  loop_id: string;
  author_email: string;
  text: string;
  created_at: string;
}

export interface Answer {
  id: string;
  loop_id: string;
  question_id: string;
  author_email: string;
  text: string;
  created_at: string;
}
