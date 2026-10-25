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
  session?: Session | null;
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
  is_completed: boolean;
  completed_at: string | null;
  my_participation?: boolean;
  created_at: string;
};

export type BroadcastDetail = Broadcast & {
  is_tutor: boolean;
  can_join: boolean;
  participants: BroadcastParticipant[];
  session: Session | null;
};

// ---------- Sessions & Reviews ----------
export type SessionType = "one_on_one" | "broadcast";

export type Review = {
  id: number;
  session: number;
  reviewer: User;
  reviewee: User;
  rating: number;
  text: string;
  created_at: string;
};

export type Session = {
  id: number;
  session_type: SessionType;
  request: number | null;
  broadcast: number | null;
  completed_at: string | null;
  marked_by: number | null;
  created_at: string;
  can_review: boolean;
  my_review: Review | null;
};

export type UserReviewsResponse = {
  reviews: Review[];
  count: number;
  average_rating: number | null;
};

// ---------- Sessions (list / detail) ----------
export type SessionOtherParty = {
  id: number;
  username: string;
};

export type SessionSummary = {
  id: number;
  session_type: SessionType;
  request: number | null;
  broadcast: number | null;
  source_title: string;
  other_parties: SessionOtherParty[];
  completed_at: string;
  created_at: string;
  can_review: boolean;
  my_review: Review | null;
};

export type SessionDetailData = SessionSummary & {
  source_link: string | null;
};

// ---------- Reports ----------
export type ReportCategory =
  | "harassment"
  | "spam"
  | "impersonation"
  | "inappropriate"
  | "other";

export type Report = {
  id: number;
  reporter: string;
  target_user: number | null;
  target_topic: number | null;
  target_broadcast: number | null;
  target_request: number | null;
  category: ReportCategory;
  reason: string;
  created_at: string;
};

export type PublicUser = {
  id: number;
  username: string;
  bio: string;
  profile_picture: string | null;
  is_tutor: boolean;
  is_tutee: boolean;
  plan: "free" | "paid";
};


// ---------- Messages ----------
export type Message = {
  id: number;
  thread: number;
  sender: User;
  body: string;
  created_at: string;
};

export type ThreadOtherParty = {
  id: number;
  username: string;
};

export type ThreadLastMessage = {
  id: number;
  body: string;
  sender_id: number;
  created_at: string;
};

export type ThreadSummary = {
  id: number;
  request: number;
  source_title: string;
  other_party: ThreadOtherParty | null;
  last_message: ThreadLastMessage | null;
  is_open: boolean;
  created_at: string;
};