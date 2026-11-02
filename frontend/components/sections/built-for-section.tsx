"use client";

import { useEffect, useState } from "react";
import { getSubjects } from "@/lib/api";

type Stat = {
  value: string;
  label: string;
};

const STATIC_FALLBACK_SUBJECTS = "30+";

export function BuiltForSection() {
  const [subjectCount, setSubjectCount] = useState<string>(
    STATIC_FALLBACK_SUBJECTS
  );

  useEffect(() => {
    let cancelled = false;
    getSubjects()
      .then((subjects) => {
        if (cancelled) return;
        if (subjects.length > 0) {
          setSubjectCount(`${subjects.length}+`);
        }
      })
      .catch(() => {
        // Keep the fallback. This section is decoration; a failed
        // fetch should not surface as an error on the landing page.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const stats: Stat[] = [
    { value: subjectCount, label: "subjects covered" },
    { value: "BaSU CS", label: "built for" },
    { value: "Free", label: "during MVP" },
    { value: "1:1 & group", label: "session formats" },
  ];

  return (
    <section className="py-12 sm:py-16 px-4 sm:px-6 max-w-6xl mx-auto w-full border-t border-border">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-6 sm:gap-8">
        {stats.map(({ value, label }) => (
          <div key={label} className="text-center">
            <p className="text-2xl sm:text-3xl font-bold text-foreground">
              {value}
            </p>
            <p className="text-xs sm:text-sm text-muted-foreground mt-1">
              {label}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}