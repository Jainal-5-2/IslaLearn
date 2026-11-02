import { ChevronDown, MessageSquare } from "lucide-react";
import Link from "next/link";

type QA = {
  question: string;
  answer: string;
};

const CONTACT_EMAIL = "asbijay@gmail.com";

const FAQ: QA[] = [
  {
    question: "Do I have to be a CS student?",
    answer:
      "No. IslaLearn is built for the BaSU CS community, but anyone 18 or older can join, learn, or tutor. The subjects skew toward Computer Science because that is who the first tutors are.",
  },
  {
    question: "Is it really free?",
    answer:
      "Yes. Everything is free during the MVP phase, including topics, broadcasts, and 1:1 sessions. There is no billing, no escrow, and no in-app money transfer. If paid features arrive later, they will come with an updated Terms of Service.",
  },
  {
    question: "What if I do not have anything to teach yet?",
    answer:
      "That is fine. You can read topics, post requests, and join broadcasts without ever creating a topic. Most people start as tutees and become tutors later, once they feel ready to explain something they already know.",
  },
  {
    question: "What happens if I miss a live session?",
    answer:
      "Group broadcasts end on schedule and are not recorded, so a missed broadcast cannot be replayed. For 1:1 requests, the tutor you were matched with can cancel the engagement if a session never happens, which reopens your request so another tutor can apply.",
  },
];

export function FaqSection() {
  return (
    <section className="bg-background py-20 sm:py-28">
      <div className="mx-auto max-w-3xl px-6 sm:px-10">
        <div className="flex flex-col items-center gap-3 text-center">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
            <MessageSquare className="h-3 w-3 text-accent" />
            FAQ
          </span>
          <h2
            className="text-balance font-semibold tracking-tight"
            style={{
              fontSize: "clamp(1.85rem, 4vw, 2.75rem)",
              letterSpacing: "-0.03em",
              lineHeight: 1.08,
            }}
          >
            Frequently asked questions
          </h2>
          <p className="max-w-xl text-balance text-muted-foreground">
            Quick answers to the questions we get the most. Can&apos;t find
            yours? Write to{" "}
            <a
              href={`mailto:${CONTACT_EMAIL}`}
              className="font-medium text-foreground underline-offset-4 hover:underline"
            >
              {CONTACT_EMAIL}
            </a>
            .
          </p>
        </div>

        <div className="mt-12 divide-y divide-border border-y border-border">
          {FAQ.map(({ question, answer }) => (
            <details key={question} className="group">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-5 [&::-webkit-details-marker]:hidden">
                <span className="text-left text-base font-medium text-foreground">
                  {question}
                </span>
                <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200 group-open:rotate-180" />
              </summary>
              <div className="pb-5 pr-8">
                <p className="text-sm leading-relaxed text-muted-foreground">
                  {answer}
                </p>
              </div>
            </details>
          ))}
        </div>

        <div className="mt-10 flex flex-col items-center justify-between gap-4 rounded-2xl border border-dashed border-border bg-muted/30 p-5 sm:flex-row sm:gap-3">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-accent/10 text-accent">
              <MessageSquare className="h-5 w-5 fill-accent/20" />
            </span>
            <div className="flex flex-col leading-tight">
              <p className="text-sm font-medium text-foreground">
                Still have a question?
              </p>
              <p className="text-xs text-muted-foreground">
                Send a note and we&apos;ll get back to you.
              </p>
            </div>
          </div>
          <Link
            href={`mailto:${CONTACT_EMAIL}`}
            className="inline-flex w-full items-center justify-center gap-2 h-10 px-5 rounded-full bg-accent text-accent-foreground text-sm font-medium hover:bg-accent/90 transition-colors sm:w-auto"
          >
            Ask us anything
          </Link>
        </div>
      </div>
    </section>
  );
}