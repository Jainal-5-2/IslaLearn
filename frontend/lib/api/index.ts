// Re-export everything so existing imports from "@/lib/api" keep working.

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

// Types
export type {
  User,
  Subject,
  Topic,
  TopicPage,
  LoginResponse,
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
} from "./topics";

// Pages
export {
  createTopicPage,
  updateTopicPage,
  deleteTopicPage,
} from "./pages";