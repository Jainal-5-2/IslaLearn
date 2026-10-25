// Client / tokens / errors
export {
  apiFetch,
  ApiError,
  clearTokens,
  getAccessToken,
  getRefreshToken,
  isLoggedIn,
  setTokens,
} from "./client";

// Pagination helpers
export {
  normalizeList,
  normalizePaginated,
  type Paginated,
} from "./pagination";

// Types
export type {
  User,
  PublicUser,
  Subject,
  Topic,
  TopicPage,
  TopicProgress,
  LoginResponse,
  RequestStatus,
  ApplicationStatus,
  Application,
  TutoringRequest,
  Broadcast,
  BroadcastDetail,
  BroadcastParticipant,
  Session,
  SessionType,
  SessionSummary,
  SessionDetailData,
  SessionOtherParty,
  Review,
  UserReviewsResponse,
  Report,
  ReportCategory,
  Message,
  ThreadOtherParty,
  ThreadLastMessage,
  ThreadSummary,
} from "./types";

// Auth
export { register, login, getMe, logout } from "./auth";

// Users (public)
export { getUser } from "./users";

// Subjects
export { getSubjects } from "./subjects";

// Topics
export {
  getTopics,
  getTopic,
  createTopic,
  updateTopic,
  deleteTopic,
  recordProgress,
  unlockTopic,
} from "./topics";

// Pages
export {
  createTopicPage,
  updateTopicPage,
  deleteTopicPage,
} from "./pages";

// Requests
export {
  getRequests,
  getRequest,
  createRequest,
  updateRequest,
  closeRequest,
  applyToRequest,
  decideApplication,
} from "./requests";

// Broadcasts
export {
  getBroadcasts,
  getBroadcast,
  createBroadcast,
  joinBroadcast,
  leaveBroadcast,
  cancelBroadcast,
  getBroadcastRoomUrl,
} from "./broadcasts";

// Sessions & Reviews
export {
  completeRequest,
  completeBroadcast,
  createReview,
  getUserReviews,
  getSessions,
  getSession,
} from "./sessions";

// Messages
export {
  getThreads,
  getThreadMessages,
  sendThreadMessage,
} from "./messages";

// Reports
export { createReport } from "./reports";