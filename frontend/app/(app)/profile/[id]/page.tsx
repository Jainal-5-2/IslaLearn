"use client";

import { Suspense, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  Star,
  BookOpen,
  Video,
  MessageSquare,
  PlayCircle,
  CheckCircle2,
  CalendarDays,
  TrendingUp,
} from "lucide-react";
import {
  getMe,
  getUser,
  getUserReviews,
  getTopics,
  getBroadcasts,
  PublicUser,
  User,
  Review,
  Topic,
  Broadcast,
  ApiError,
} from "@/lib/api";
import { PageSkeleton } from "@/components/page-skeleton";
import { ReportButton } from "@/components/report-button";
import { cn } from "@/lib/utils";

export default function Page() {
  return (
    <Suspense fallback={<PageSkeleton variant="list" />}>
      <ProfilePage />
    </Suspense>
  );
}

function ProfilePage() {
  const params = useParams();
  const userId = Number(params.id);

  const [user, setUser] = useState<PublicUser | null>(null);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [averageRating, setAverageRating] = useState<number | null>(null);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [learningTopics, setLearningTopics] = useState<Topic[]>([]);
  const [broadcasts, setBroadcasts] = useState<Broadcast[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      getMe().catch(() => null),
      getUser(userId),
      getUserReviews(userId),
      getTopics({ createdBy: userId }),
      getTopics({ progressFor: userId }).catch(() => ({
        count: 0,
        next: null,
        previous: null,
        results: [] as Topic[],
      })),
      getBroadcasts({ tutor: userId, past: true }),
    ])
      .then(([me, u, reviewData, topicsData, learningData, broadcastsData]) => {
        if (cancelled) return;
        setCurrentUser(me);
        setUser(u);
        setReviews(reviewData.reviews);
        setAverageRating(reviewData.average_rating);
        setTopics(topicsData.results);
        setLearningTopics(learningData.results);
        setBroadcasts(broadcastsData.results);
      })
      .catch((e) => {
        if (cancelled) return;
        if (e instanceof ApiError && e.status === 404) {
          setError("User not found.");
        } else {
          setError(e instanceof Error ? e.message : "Failed to load profile");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  if (loading) {
    return <PageSkeleton variant="list" />;
  }

  if (error || !user) {
    return (
      <div className="text-center py-20">
        <p className="text-red-600 mb-4">{error || "User not found."}</p>
        <Link href="/dashboard" className="text-accent underline">
          Back to dashboard
        </Link>
      </div>
    );
  }

  const isSelf = currentUser?.id === userId;
  const displayName = user.username;

  // The Learning section is meaningful on someone else's profile only
  // when they actually have topics in progress. On your own profile,
  // show the empty state too so you can see there is nothing to resume.
  const showLearning = learningTopics.length > 0 || isSelf;

  const memberSince = (() => {
    if (!user.date_joined) return null;
    const d = new Date(user.date_joined);
    if (Number.isNaN(d.getTime())) return null;
    return d.toLocaleDateString(undefined, {
      year: "numeric",
      month: "long",
    });
  })();

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="bg-card border border-border rounded-xl p-6">
        <div className="flex items-start gap-4">
          <div className="h-16 w-16 rounded-full bg-accent/20 flex items-center justify-center text-2xl font-bold text-accent shrink-0 overflow-hidden">
            {user.profile_picture ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={user.profile_picture}
                alt=""
                className="h-full w-full object-cover"
              />
            ) : (
              displayName[0]?.toUpperCase()
            )}
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl font-bold truncate">{displayName}</h1>
            {memberSince && (
              <p className="text-xs text-muted-foreground mt-1 inline-flex items-center gap-1">
                <CalendarDays className="h-3.5 w-3.5" />
                Member since {memberSince}
              </p>
            )}
            {isSelf && (
              <p className="text-sm text-muted-foreground mt-2">
                This is your profile.
              </p>
            )}
            {user.bio && (
              <p className="text-sm text-muted-foreground mt-2 whitespace-pre-wrap">
                {user.bio}
              </p>
            )}
            <div className="flex flex-wrap items-center gap-3 mt-3">
              {averageRating !== null && (
                <div className="flex items-center gap-2">
                  <Stars rating={averageRating} />
                  <span className="text-sm text-muted-foreground">
                    {averageRating.toFixed(1)}
                  </span>
                </div>
              )}
              <Link
                href={`/profile/${userId}/reviews`}
                className="inline-flex items-center gap-1.5 text-sm text-accent hover:underline font-medium"
              >
                <MessageSquare className="h-4 w-4" />
                {reviews.length} {reviews.length === 1 ? "review" : "reviews"}
              </Link>
              {!isSelf && <ReportButton target={{ target_user: userId }} />}
            </div>
          </div>
        </div>
      </div>

      {showLearning && (
        <div className="bg-card border border-border rounded-xl p-6">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Learning
          </h2>
          {learningTopics.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {isSelf
                ? "You haven't started any topics yet. Browse the topic list to find something to learn."
                : "No topics in progress."}
            </p>
          ) : (
            <ul className="space-y-2">
              {learningTopics.map((t) => {
                const progress = t.progress;
                const isCompleted = !!progress?.is_completed;
                const isInProgress = !!progress && !isCompleted;
                return (
                  <li key={t.id}>
                    <Link
                      href={`/topics/${t.id}`}
                      className="flex items-center justify-between gap-2 p-3 rounded-md bg-background border border-border hover:border-accent/40 transition-colors"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">
                          {t.title}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {t.subject.name} · {t.page_count} pages
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {isInProgress && (
                          <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-1 bg-accent/10 text-accent rounded-md">
                            <PlayCircle className="h-3 w-3" />
                            Continue
                          </span>
                        )}
                        {isCompleted && (
                          <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-1 bg-green-500/10 text-green-600 rounded-md">
                            <CheckCircle2 className="h-3 w-3" />
                            Completed
                          </span>
                        )}
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}

      <div className="bg-card border border-border rounded-xl p-6">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <BookOpen className="h-5 w-5" />
          Topics created
        </h2>
        {topics.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No topics created yet.
          </p>
        ) : (
          <ul className="space-y-2">
            {topics.map((t) => (
              <li key={t.id}>
                <Link
                  href={`/topics/${t.id}`}
                  className="flex items-center justify-between gap-2 p-3 rounded-md bg-background border border-border hover:border-accent/40 transition-colors"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{t.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {t.subject.name} · {t.page_count} pages
                    </p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="bg-card border border-border rounded-xl p-6">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Video className="h-5 w-5" />
          Broadcasts hosted
        </h2>
        {broadcasts.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No broadcasts hosted yet.
          </p>
        ) : (
          <ul className="space-y-2">
            {broadcasts.map((b) => (
              <li key={b.id}>
                <Link
                  href={`/broadcasts/${b.id}`}
                  className="flex items-center justify-between gap-2 p-3 rounded-md bg-background border border-border hover:border-accent/40 transition-colors"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{b.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {b.subject.name} ·{" "}
                      {new Date(b.scheduled_at).toLocaleDateString()}
                    </p>
                  </div>
                  {b.is_cancelled && (
                    <span className="text-xs font-medium px-2 py-1 bg-red-500/10 text-red-600 rounded-md shrink-0">
                      Cancelled
                    </span>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function Stars({
  rating,
  size = "md",
}: {
  rating: number;
  size?: "sm" | "md";
}) {
  const iconClass = size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4";
  return (
    <div className="flex items-center gap-0.5" aria-label={`${rating} stars`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          className={cn(
            iconClass,
            n <= Math.round(rating)
              ? "fill-yellow-400 text-yellow-400"
              : "text-muted-foreground/40"
          )}
        />
      ))}
    </div>
  );
}