// ---------- User ----------
export type User = {
  id: number;
  username: string;
  email: string;
  bio: string;
  profile_picture: string | null;
  is_tutor: boolean;
  is_tutee: boolean;
  plan: "free" | "paid";
};

// ---------- Subjects ----------
export type Subject = {
  id: number;
  name: string;
  description: string;
};

// ---------- Topics ----------
export type TopicPage = {
  id: number;
  order: number;
  page_type: "text" | "video" | "quiz";
  content: any;
  is_locked: boolean;
};

export type Topic = {
  id: number;
  subject: Subject;
  created_by: User;
  title: string;
  description: string;
  is_published: boolean;
  free_page_count: number;
  page_count: number;
  pages?: TopicPage[];
  created_at: string;
};

// ---------- Auth ----------
export type LoginResponse = {
  access: string;
  refresh: string;
};