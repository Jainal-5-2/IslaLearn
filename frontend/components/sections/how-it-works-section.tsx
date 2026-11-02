import { BookOpen, MessageSquare, Star } from "lucide-react";

const STEPS = [
  {
    number: "01",
    Icon: BookOpen,
    title: "Pick a topic",
    description:
      "Browse structured lessons written by your classmates. Read at your own pace, on any device.",
  },
  {
    number: "02",
    Icon: MessageSquare,
    title: "Get help live",
    description:
      "Stuck on something? Book a 1:1 session or join a group broadcast for a live walkthrough.",
  },
  {
    number: "03",
    Icon: Star,
    title: "Review and level up",
    description:
      "After a session, leave a review. Good tutors build a reputation, and good tutees get matched faster.",
  },
];

export function HowItWorksSection() {
  return (
    <section className="py-20 sm:py-24 px-4 sm:px-6 max-w-6xl mx-auto w-full">
      <div className="text-center max-w-2xl mx-auto mb-12 sm:mb-16">
        <h2 className="text-2xl sm:text-3xl font-bold tracking-tight mb-4">
          How it works
        </h2>
        <p className="text-muted-foreground">
          Three steps from "I do not get this" to "oh, that is how it works."
        </p>
      </div>

      <ol className="grid grid-cols-1 md:grid-cols-3 gap-8 sm:gap-10">
        {STEPS.map(({ number, Icon, title, description }) => (
          <li key={number} className="relative flex flex-col">
            <span
              className="text-5xl font-bold tracking-tight text-muted-foreground/30 leading-none mb-4"
              aria-hidden="true"
            >
              {number}
            </span>
            <div className="w-12 h-12 rounded-xl bg-accent/10 text-accent flex items-center justify-center mb-4">
              <Icon className="h-6 w-6" />
            </div>
            <h3 className="text-lg font-bold mb-2">{title}</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {description}
            </p>
          </li>
        ))}
      </ol>
    </section>
  );
}