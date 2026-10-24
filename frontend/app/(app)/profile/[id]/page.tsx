"use client";

import { Suspense, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Star, BookOpen, Video, MessageSquare } from "lucide-react";
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
      getBroadcasts({ tutor: userId, past: true }),
    ])
      .then(([me, u, reviewData, topicsData, broadcastsData]) => {
        if (cancelled) return;
        setCurrentUser(me);
        setUser(u);
        setReviews(reviewData.reviews);
        setAverageRating(reviewData.average_rating);
        setTopics(topicsData.results);
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

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="bg-card border border-border rounded-xl p-6">
        <div className="flex items-start gap-4">
          <div className="h-16 w-16 rounded-full bg-accent/20 flex items-center justify-center text-2xl font-bold text-accent shrink-0">
            {displayName[0]?.toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl font-bold truncate">{displayName}</h1>
            {isSelf && (
              <p className="text-sm text-muted-foreground mt-1">
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
              {!isSelf && <ReportButton targetUserId={userId} />}
            </div>
          </div>
        </div>
      </div>

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