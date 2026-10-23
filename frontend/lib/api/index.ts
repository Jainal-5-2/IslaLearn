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
  Subject,
  Topic,
  TopicPage,
  TopicProgress,
  LoginResponse,
  RequestStatus,
  ApplicationStatus,
  Application,
  TutoringRequest,
} from "./types";

// Auth
export { register, login, getMe, logout } from "./auth";

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