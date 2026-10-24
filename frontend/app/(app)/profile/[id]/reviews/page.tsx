"use client";

import { Suspense, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Star } from "lucide-react";
import {
  getMe,
  getUser,
  getUserReviews,
  PublicUser,
  User,
  Review,
  ApiError,
} from "@/lib/api";
import { PageSkeleton } from "@/components/page-skeleton";
import { cn } from "@/lib/utils";

export default function Page() {
  return (
    <Suspense fallback={<PageSkeleton variant="list" />}>
      <ReviewsPage />
    </Suspense>
  );
}

function ReviewsPage() {
  const params = useParams();
  const userId = Number(params.id);

  const [user, setUser] = useState<PublicUser | null>(null);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [averageRating, setAverageRating] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      getMe().catch(() => null),
      getUser(userId),
      getUserReviews(userId),
    ])
      .then(([me, u, reviewData]) => {
        if (cancelled) return;
        setCurrentUser(me);
        setUser(u);
        setReviews(reviewData.reviews);
        setAverageRating(reviewData.average_rating);
      })
      .catch((e) => {
        if (cancelled) return;
        if (e instanceof ApiError && e.status === 404) {
          setError("User not found.");
        } else {
          setError(e instanceof Error ? e.message : "Failed to load reviews");
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
        <Link href={`/profile/${userId}`} className="text-accent underline">
          Back to profile
        </Link>
      </div>
    );
  }

  const isSelf = currentUser?.id === userId;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <Link
        href={`/profile/${userId}`}
        className="inline-block text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        &larr; Back to profile
      </Link>

      <div className="bg-card border border-border rounded-xl p-6">
        <div className="flex items-center justify-between gap-3 flex-wrap mb-2">
          <h1 className="text-2xl font-bold">
            Reviews for {user.username}
          </h1>
          {isSelf && (
            <span className="text-sm text-muted-foreground">
              This is your profile.
            </span>
          )}
        </div>
        {averageRating !== null && (
          <div className="flex items-center gap-2">
            <Stars rating={averageRating} />
            <span className="text-sm text-muted-foreground">
              {averageRating.toFixed(1)} · {reviews.length}{" "}
              {reviews.length === 1 ? "review" : "reviews"}
            </span>
          </div>
        )}
      </div>

      <div className="bg-card border border-border rounded-xl p-6">
        {reviews.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No reviews yet. Reviews are left after a completed session.
          </p>
        ) : (
          <ul className="space-y-3">
            {reviews.map((review) => (
              <li
                key={review.id}
                className="border border-border rounded-lg p-4 bg-background"
              >
                <div className="flex items-center justify-between mb-2 gap-2 flex-wrap">
                  <Link
                    href={`/profile/${review.reviewer.id}`}
                    className="text-sm font-medium hover:text-accent transition-colors"
                  >
                    {review.reviewer.username}
                  </Link>
                  <Stars rating={review.rating} size="sm" />
                </div>
                {review.text && (
                  <p className="text-sm whitespace-pre-wrap mb-2">
                    {review.text}
                  </p>
                )}
                <p className="text-xs text-muted-foreground">
                  {new Date(review.created_at).toLocaleDateString()}
                </p>
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