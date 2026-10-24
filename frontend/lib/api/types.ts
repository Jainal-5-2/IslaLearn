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

// ---------- Topic Progress ----------
export type TopicProgress = {
  last_page_index: number;
  is_unlocked: boolean;
  is_completed: boolean;
  last_visited_at: string;
  completed_at: string | null;
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
  progress: TopicProgress | null;
  created_at: string;
};

// ---------- Auth ----------
export type LoginResponse = {
  access: string;
  refresh: string;
};

// ---------- Requests ----------
export type RequestStatus = "open" | "closed";
export type ApplicationStatus = "pending" | "accepted" | "rejected";

export type Application = {
  id: number;
  tutor: User;
  message: string;
  status: ApplicationStatus;
  created_at: string;
};

export type TutoringRequest = {
  id: number;
  tutee: User;
  subject: Pick<Subject, "id" | "name">;
  description: string;
  preferred_time: string | null;
  status: RequestStatus;
  application_count?: number;
  applications?: Application[];
  can_edit?: boolean;
  subject_locked?: boolean;
  my_application_status?: ApplicationStatus | null;
  created_at: string;
  updated_at?: string;
};

// ---------- Broadcasts ----------
export type BroadcastParticipant = {
  id: number;
  user: User;
  joined_at: string;
};

export type Broadcast = {
  id: number;
  tutor: User;
  subject: Pick<Subject, "id" | "name">;
  title: string;
  description: string;
  scheduled_at: string;
  duration_minutes: number;
  capacity: number;
  participant_count: number;
  is_full: boolean;
  is_cancelled: boolean;
  my_participation?: boolean;
  created_at: string;
};

export type BroadcastDetail = Broadcast & {
  is_tutor: boolean;
  can_join: boolean;
  participants: BroadcastParticipant[];
};