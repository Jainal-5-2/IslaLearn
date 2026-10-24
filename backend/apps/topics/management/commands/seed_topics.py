from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from apps.topics.models import Subject, Topic, TopicPage

User = get_user_model()


def _closing_page(next_topic_hint):
    """Shared closing page used by every topic."""
    return {
        "page_type": "text",
        "content": {
            "body": (
                "Nice work.\n\n"
                "You made it to the end. If you want to keep going, "
                "head back to /topics and pick your next topic. If any "
                "part of this one still feels shaky, you can post a "
                "request at /requests/new and a classmate who has been "
                "through it can walk you through the rough spots one on "
                "one.\n\n"
                f"Next up, worth a look: {next_topic_hint}.\n\n"
                "See you in the next one."
            )
        },
    }


TOPICS = [
    {
        "subject": "Python",
        "title": "Python Functions: A Practical Introduction",
        "description": (
            "Learn how to write, call, and compose functions in Python. "
            "Covers parameters, return values, default arguments, and scope. "
            "Designed for students who've seen Python syntax but want to "
            "write cleaner, more reusable code."
        ),
        "is_published": True,
        "free_page_count": 2,
        "pages": [
            {
                "page_type": "text",
                "content": {
                    "body": (
                        "Why functions?\n\n"
                        "Imagine writing a program that computes the area of "
                        "rectangles. Without functions, you'd copy-paste the "
                        "same `width * height` calculation everywhere. If the "
                        "formula ever changed, you'd have to hunt down every "
                        "copy. A function turns that calculation into a named, "
                        "reusable piece of logic:\n\n"
                        "    def rectangle_area(width, height):\n"
                        "        return width * height\n\n"
                        "Now everywhere you need the area, you call "
                        "`rectangle_area(3, 4)` and get `12`. One definition, "
                        "many uses.\n\n"
                        "Functions are the building blocks of every Python "
                        "program bigger than a page. In this topic, we'll work "
                        "through the mechanics and the patterns that make them "
                        "pleasant to use."
                    )
                },
            },
            {
                "page_type": "quiz",
                "content": {
                    "questions": [
                        {
                            "question": "What does a Python function return if it has no `return` statement?",
                            "options": ["0", "None", "An empty string", "It raises an error"],
                            "correct_index": 1,
                        },
                        {
                            "question": "What is the main benefit of wrapping a repeated calculation in a function?",
                            "options": [
                                "It runs faster",
                                "It can be reused and changed in one place",
                                "It uses less memory",
                                "It avoids syntax errors",
                            ],
                            "correct_index": 1,
                        },
                    ]
                },
            },
            {
                "page_type": "video",
                "content": {
                    "url": "https://www.youtube.com/watch?v=9Os0o3wzS_I"
                },
            },
            {
                "page_type": "quiz",
                "content": {
                    "questions": [
                        {
                            "question": "Which call is valid for `def area(w, h): ...`?",
                            "options": [
                                "area(w=3, 4)",
                                "area(3, h=4)",
                                "area(h=4, w=3)",
                                "Both B and C",
                            ],
                            "correct_index": 3,
                        },
                        {
                            "question": "What happens when `return` executes inside a `for` loop?",
                            "options": [
                                "The loop continues",
                                "The function exits and the value is returned",
                                "The loop restarts",
                                "The loop is skipped",
                            ],
                            "correct_index": 1,
                        },
                    ]
                },
            },
            {
                "page_type": "text",
                "content": {
                    "body": (
                        "Parameters, arguments, and the mistakes to avoid\n\n"
                        "The names inside the parentheses are *parameters*. "
                        "The values you pass when calling are *arguments*.\n\n"
                        "    def greet(name):\n"
                        "        return f'Hello, {name}!'\n\n"
                        "Python matches arguments to parameters by position by "
                        "default. You can also pass them by name:\n\n"
                        "    greet(name='Maria')   # same result\n\n"
                        "This becomes useful when a function has several "
                        "parameters and you only want to override one. Mixing "
                        "positional and keyword arguments is allowed, but "
                        "positional arguments must come first.\n\n"
                        "Two mistakes to watch for:\n\n"
                        "1. Forgetting `return`. A function without an explicit "
                        "`return` returns `None`, even if it does useful work "
                        "internally. If you wrote `return x` inside a loop and "
                        "meant to collect multiple values, build a list and "
                        "return it once at the end.\n\n"
                        "2. Shadowing with the same name. `def f(x): x = x + 1` "
                        "modifies the local copy of `x`, not the caller's "
                        "variable. If you want the caller to see the change, "
                        "return the new value and let them reassign."
                    )
                },
            },
            _closing_page("Data Structures, then Recursion"),
        ],
    },
    {
        "subject": "Data Structures",
        "title": "Understanding Recursion With Linked Lists",
        "description": (
            "Recursion clicks when you see it walk a real structure. This "
            "topic builds intuition by tracing recursive functions over a "
            "linked list: length, search, and reverse."
        ),
        "is_published": True,
        "free_page_count": 2,
        "pages": [
            {
                "page_type": "text",
                "content": {
                    "body": (
                        "What recursion actually is\n\n"
                        "A recursive function is a function that calls itself. "
                        "That's it. There's no special syntax, no keywords, "
                        "just a function that shows up in its own body. The "
                        "hard part isn't writing recursion; it's convincing "
                        "yourself it works.\n\n"
                        "Every recursive function has two parts:\n\n"
                        "1. A *base case*: the smallest input where the "
                        "function can answer directly, without calling itself.\n"
                        "2. A *recursive case*: the function calls itself on a "
                        "smaller version of the input, trusting it to return "
                        "the right answer.\n\n"
                        "That second word (*trusting*) is the mental shift. "
                        "You don't trace the whole call stack in your head. "
                        "You convince yourself that if the recursive call "
                        "works for a smaller input, your function is correct "
                        "for the current input. That's the whole proof "
                        "technique (induction, if you've seen it)."
                    )
                },
            },
            {
                "page_type": "quiz",
                "content": {
                    "questions": [
                        {
                            "question": "What are the two required parts of a recursive function?",
                            "options": [
                                "A loop and a return",
                                "A base case and a recursive case",
                                "A helper function and a global variable",
                                "An if statement and a for loop",
                            ],
                            "correct_index": 1,
                        },
                        {
                            "question": "Why does the base case matter?",
                            "options": [
                                "It makes the function faster",
                                "It stops the recursion from running forever",
                                "It handles type errors",
                                "It is optional",
                            ],
                            "correct_index": 1,
                        },
                    ]
                },
            },
            {
                "page_type": "text",
                "content": {
                    "body": (
                        "Walking a linked list\n\n"
                        "In this topic we apply recursion to a linked list "
                        "node:\n\n"
                        "    class Node:\n"
                        "        def __init__(self, value, next=None):\n"
                        "            self.value = value\n"
                        "            self.next = next\n\n"
                        "Length, iteratively, for comparison:\n\n"
                        "    def length_iter(node):\n"
                        "        count = 0\n"
                        "        while node is not None:\n"
                        "            count += 1\n"
                        "            node = node.next\n"
                        "        return count\n\n"
                        "Now the recursive version:\n\n"
                        "    def length_rec(node):\n"
                        "        if node is None:\n"
                        "            return 0\n"
                        "        return 1 + length_rec(node.next)\n\n"
                        "The base case is `node is None` (an empty list has "
                        "length 0). The recursive case says: the length of a "
                        "list starting at `node` is 1 (for `node` itself) plus "
                        "the length of the list starting at `node.next`.\n\n"
                        "Trace it on `1 -> 2 -> 3 -> None`:\n\n"
                        "    length_rec(1) = 1 + length_rec(2)\n"
                        "                  = 1 + (1 + length_rec(3))\n"
                        "                  = 1 + (1 + (1 + length_rec(None)))\n"
                        "                  = 1 + (1 + (1 + 0))\n"
                        "                  = 3"
                    )
                },
            },
            {
                "page_type": "quiz",
                "content": {
                    "questions": [
                        {
                            "question": "What is the base case in `length_rec`?",
                            "options": [
                                "`node is None`",
                                "`node.value == 0`",
                                "`node.next is None`",
                                "The function has no base case",
                            ],
                            "correct_index": 0,
                        },
                        {
                            "question": "If you forget `return` before a recursive call, what does the function return?",
                            "options": [
                                "The correct value anyway",
                                "`None`",
                                "`0`",
                                "It raises a `RecursionError`",
                            ],
                            "correct_index": 1,
                        },
                    ]
                },
            },
            {
                "page_type": "text",
                "content": {
                    "body": (
                        "Two base cases, and the mistake to avoid\n\n"
                        "Search: does the list contain a value?\n\n"
                        "    def contains(node, target):\n"
                        "        if node is None:\n"
                        "            return False\n"
                        "        if node.value == target:\n"
                        "            return True\n"
                        "        return contains(node.next, target)\n\n"
                        "Two base cases this time: the empty list (return "
                        "False) and the head matching (return True). The "
                        "recursive case is the only path that actually "
                        "advances.\n\n"
                        "Two base cases is common. Whenever a function has a "
                        "reason to stop early, that reason becomes a base "
                        "case. Here, finding the value early is exactly that.\n\n"
                        "The mistake to avoid: if you write the recursive case "
                        "as `return contains(node.next, target)` you're fine. "
                        "But if you write `contains(node.next, target)` "
                        "without `return`, Python executes the call, then "
                        "discards its result and returns `None`. This is one "
                        "of the most common beginner mistakes with recursion. "
                        "Don't forget the `return` on the recursive case."
                    )
                },
            },
            _closing_page("Algorithms, then Big-O"),
        ],
    },
    {
        "subject": "Web Development",
        "title": "How HTTP Works: A Visual Walkthrough",
        "description": (
            "Every web app you've ever used is built on HTTP. This topic "
            "walks through what actually happens when you type a URL and hit "
            "Enter: request, response, headers, status codes."
        ),
        "is_published": True,
        "free_page_count": 2,
        "pages": [
            {
                "page_type": "text",
                "content": {
                    "body": (
                        "What HTTP is (and isn't)\n\n"
                        "HTTP is a text-based protocol for a client to ask a "
                        "server for something and get a response back. That's "
                        "the whole idea. Every web page, image, API call, and "
                        "file download is the same pattern: the client sends a "
                        "request, the server sends a response.\n\n"
                        "HTTP is *stateless*: the server doesn't remember you "
                        "between requests. If you log in, close your browser, "
                        "and come back, the server has no idea it's you unless "
                        "you send something (a cookie, a token) that proves it. "
                        "This is why authentication exists."
                    )
                },
            },
            {
                "page_type": "quiz",
                "content": {
                    "questions": [
                        {
                            "question": "What does it mean that HTTP is stateless?",
                            "options": [
                                "The server doesn't remember you between requests",
                                "Requests must be sent in order",
                                "Responses are always cached",
                                "The client cannot send headers",
                            ],
                            "correct_index": 0,
                        },
                        {
                            "question": "Which two things make up every HTTP exchange?",
                            "options": [
                                "A request and a response",
                                "A cookie and a session",
                                "A port and a host",
                                "A GET and a POST",
                            ],
                            "correct_index": 0,
                        },
                    ]
                },
            },
            {
                "page_type": "video",
                "content": {
                    "url": "https://www.youtube.com/watch?v=wW2A5SZ3GkI"
                },
            },
            {
                "page_type": "quiz",
                "content": {
                    "questions": [
                        {
                            "question": "Which HTTP method is used to read a resource without side effects?",
                            "options": ["POST", "GET", "DELETE", "PATCH"],
                            "correct_index": 1,
                        },
                        {
                            "question": "A `404` status code means?",
                            "options": [
                                "The server crashed",
                                "The request succeeded",
                                "The client asked for something that doesn't exist",
                                "The client needs to authenticate",
                            ],
                            "correct_index": 2,
                        },
                    ]
                },
            },
            {
                "page_type": "text",
                "content": {
                    "body": (
                        "Anatomy of a request and a response\n\n"
                        "A request, as it goes on the wire:\n\n"
                        "    GET /hello HTTP/1.1\n"
                        "    Host: example.com\n"
                        "    User-Agent: Mozilla/5.0 ...\n"
                        "    Accept: text/html\n\n"
                        "The first line is the *request line*: method, path, "
                        "protocol version. Everything after that is a *header*, "
                        "a key-value pair the server might care about.\n\n"
                        "Methods tell the server what kind of action you want:\n\n"
                        "- `GET`: read something, no side effects\n"
                        "- `POST`: create something (submit a form, upload a file)\n"
                        "- `PATCH`: modify something partially\n"
                        "- `DELETE`: remove something\n\n"
                        "A response, as it comes back:\n\n"
                        "    HTTP/1.1 200 OK\n"
                        "    Content-Type: text/html; charset=utf-8\n"
                        "    Content-Length: 42\n"
                        "\n"
                        "    <h1>Hello, world</h1>\n\n"
                        "Status codes come in five families:\n\n"
                        "- `2xx`: success (200, 201, 204)\n"
                        "- `3xx`: redirect (301, 302, 304)\n"
                        "- `4xx`: client error (400, 401, 403, 404)\n"
                        "- `5xx`: server error (500, 502, 503)\n\n"
                        "If you see a 4xx, *you* (the client) sent something the "
                        "server couldn't accept. If you see a 5xx, the server "
                        "messed up. Those are the two most useful status-code "
                        "facts to remember."
                    )
                },
            },
            _closing_page("Web Development, then Building an API"),
        ],
    },
    {
        "subject": "Algorithms",
        "title": "Big-O Notation Without the Math Scare",
        "description": (
            "Big-O isn't about counting operations. It's about how a "
            "program's runtime grows as the input grows. This topic covers "
            "the practical core: O(1), O(log n), O(n), O(n log n), O(n^2), "
            "and how to eyeball which one a loop has."
        ),
        "is_published": True,
        "free_page_count": 2,
        "pages": [
            {
                "page_type": "text",
                "content": {
                    "body": (
                        "What Big-O actually measures\n\n"
                        "Big-O notation answers one question: *as the input "
                        "gets larger, how does the number of steps grow?* Not "
                        "the exact number of steps, not the constant factor "
                        "multiplied in front, just the *shape* of the growth.\n\n"
                        "This is why we drop constants. `O(2n)` and `O(n)` are "
                        "both written `O(n)` because doubling the input doubles "
                        "the work in both. The 2 doesn't matter when you're "
                        "asking \"how does it scale?\" It's a fixed multiplier "
                        "that doesn't change as `n` grows.\n\n"
                        "Similarly, `O(n^2 + 100n)` is written `O(n^2)` because "
                        "once `n` is large enough, the `n^2` term dwarfs the "
                        "`100n` term. Big-O only cares about the dominant term."
                    )
                },
            },
            {
                "page_type": "quiz",
                "content": {
                    "questions": [
                        {
                            "question": "What does Big-O actually measure?",
                            "options": [
                                "The exact number of operations",
                                "How runtime grows as input grows",
                                "The amount of memory used",
                                "The number of bugs in the code",
                            ],
                            "correct_index": 1,
                        },
                        {
                            "question": "Why is `O(2n)` the same as `O(n)`?",
                            "options": [
                                "Because 2 is a small number",
                                "Because constants are dropped in Big-O",
                                "Because `n` is never really that big",
                                "Because `2n` is slower",
                            ],
                            "correct_index": 1,
                        },
                    ]
                },
            },
            {
                "page_type": "video",
                "content": {
                    "url": "https://www.youtube.com/watch?v=D6xkbGLQesk"
                },
            },
            {
                "page_type": "quiz",
                "content": {
                    "questions": [
                        {
                            "question": "What is the Big-O complexity of accessing `arr[i]`?",
                            "options": ["O(1)", "O(log n)", "O(n)", "O(n^2)"],
                            "correct_index": 0,
                        },
                        {
                            "question": "Two nested loops over the same `n`-item array. What's the complexity?",
                            "options": ["O(1)", "O(n)", "O(n log n)", "O(n^2)"],
                            "correct_index": 3,
                        },
                    ]
                },
            },
            {
                "page_type": "text",
                "content": {
                    "body": (
                        "Eyeballing a loop\n\n"
                        "Rule of thumb: count nested loops. One loop over `n` "
                        "items is `O(n)`. Two nested loops over `n` items each "
                        "is `O(n^2)`. Three nested loops is `O(n^3)`. This works "
                        "as long as each loop actually iterates `n` times and "
                        "the input size is the thing you're counting.\n\n"
                        "    # O(n): one loop\n"
                        "    total = 0\n"
                        "    for x in arr:\n"
                        "        total += x\n\n"
                        "    # O(n^2): two nested loops\n"
                        "    for x in arr:\n"
                        "        for y in arr:\n"
                        "            print(x, y)\n\n"
                        "Two wrinkles:\n\n"
                        "1. A loop that runs a constant number of times isn't "
                        "`O(n)`: `for i in range(10): ...` is `O(1)`.\n\n"
                        "2. A loop over half the array is still `O(n)`: the "
                        "constant `1/2` drops. `O(n/2) = O(n)`.\n\n"
                        "Once you can eyeball loops, you can reason about most "
                        "algorithms you'll read in class without doing the full "
                        "formal derivation."
                    )
                },
            },
            _closing_page("SQL, then Database Design"),
        ],
    },
    {
        "subject": "SQL",
        "title": "SQL Joins Explained With Real Examples",
        "description": (
            "Inner, left, right, and full outer joins: what each one returns "
            "and when to use it. Includes the one-sentence rule that makes "
            "joins click."
        ),
        "is_published": True,
        "free_page_count": 2,
        "pages": [
            {
                "page_type": "text",
                "content": {
                    "body": (
                        "Why joins exist\n\n"
                        "SQL databases avoid duplicating data. Instead of "
                        "storing a student's name on every row of an "
                        "`enrollments` table, you store a `student_id` and look "
                        "up the name in a `students` table when you need it. "
                        "This is fine until you want to display *both* (the "
                        "enrollment and the student's name) in one result.\n\n"
                        "That's what a join does: it combines rows from two "
                        "tables based on a related column.\n\n"
                        "    SELECT students.name, enrollments.course\n"
                        "    FROM students\n"
                        "    JOIN enrollments ON students.id = enrollments.student_id;\n\n"
                        "The `ON` clause says *how to match rows*."
                    )
                },
            },
            {
                "page_type": "quiz",
                "content": {
                    "questions": [
                        {
                            "question": "What does a JOIN do?",
                            "options": [
                                "Combines rows from two tables based on a related column",
                                "Deletes duplicate rows",
                                "Creates a new table",
                                "Sorts the result set",
                            ],
                            "correct_index": 0,
                        },
                        {
                            "question": "What does the `ON` clause specify?",
                            "options": [
                                "The sort order",
                                "How rows from the two tables match",
                                "Which columns to return",
                                "How many rows to return",
                            ],
                            "correct_index": 1,
                        },
                    ]
                },
            },
            {
                "page_type": "video",
                "content": {
                    "url": "https://www.youtube.com/watch?v=79EBoVPUzkE"
                },
            },
            {
                "page_type": "quiz",
                "content": {
                    "questions": [
                        {
                            "question": "Which join returns only rows where both sides match?",
                            "options": [
                                "LEFT JOIN",
                                "INNER JOIN",
                                "RIGHT JOIN",
                                "FULL OUTER JOIN",
                            ],
                            "correct_index": 1,
                        },
                        {
                            "question": "You want to find students with zero enrollments. Which join do you use?",
                            "options": [
                                "INNER JOIN",
                                "RIGHT JOIN",
                                "LEFT JOIN and filter to NULL on the right side",
                                "FULL OUTER JOIN",
                            ],
                            "correct_index": 2,
                        },
                    ]
                },
            },
            {
                "page_type": "text",
                "content": {
                    "body": (
                        "INNER, LEFT, and the rule that makes it click\n\n"
                        "INNER JOIN returns only rows where the match succeeds "
                        "on both sides. If a student has no enrollments, they "
                        "won't appear.\n\n"
                        "LEFT JOIN returns all rows from the left table, plus "
                        "matched rows from the right. If a student has no "
                        "enrollments, they still appear, with `NULL` in the "
                        "enrollment columns.\n\n"
                        "That is the join you want when you're asking \"who has "
                        "*not* done X?\" Join, filter to "
                        "`WHERE enrollments.id IS NULL`, and you have the "
                        "students with no enrollments.\n\n"
                        "`RIGHT JOIN` is the mirror. In practice most people "
                        "never write it; they swap the tables and use LEFT.\n\n"
                        "MySQL does *not* support `FULL OUTER JOIN` directly. "
                        "You have to emulate it with a `LEFT JOIN UNION RIGHT "
                        "JOIN`.\n\n"
                        "The one-sentence rule:\n\n"
                        "*The type of join determines what happens to unmatched "
                        "rows.* INNER drops them. LEFT keeps them from the "
                        "left. RIGHT keeps them from the right. FULL keeps "
                        "them from both."
                    )
                },
            },
            _closing_page("Version Control (Git), then Branching"),
        ],
    },
    {
        "subject": "Version Control (Git)",
        "title": "Git Basics: From Commit to Push",
        "description": (
            "The five Git commands that cover 90% of daily work, plus the "
            "mental model that makes them make sense: working directory, "
            "staging area, local repo, remote."
        ),
        "is_published": True,
        "free_page_count": 2,
        "pages": [
            {
                "page_type": "text",
                "content": {
                    "body": (
                        "The four places your code lives\n\n"
                        "Git confuses people because it has four distinct "
                        "places where files can be, and moving between them "
                        "requires different commands.\n\n"
                        "1. **Working directory**: the files as they exist on "
                        "disk right now.\n\n"
                        "2. **Staging area** (also called *the index*): a "
                        "holding area where you put changes you intend to "
                        "commit. Files move here via `git add`.\n\n"
                        "3. **Local repository**: the committed history "
                        "stored in `.git/`. Files move here via `git commit`.\n\n"
                        "4. **Remote**: a copy of the repository on a server "
                        "(GitHub, GitLab, etc.). Files move to the remote via "
                        "`git push`, and changes from the remote come back via "
                        "`git pull`."
                    )
                },
            },
            {
                "page_type": "quiz",
                "content": {
                    "questions": [
                        {
                            "question": "Where do files live after `git add` but before `git commit`?",
                            "options": [
                                "Working directory",
                                "Staging area",
                                "Local repository",
                                "Remote",
                            ],
                            "correct_index": 1,
                        },
                        {
                            "question": "Which command sends your local commits to the remote?",
                            "options": ["git add", "git commit", "git push", "git pull"],
                            "correct_index": 2,
                        },
                    ]
                },
            },
            {
                "page_type": "video",
                "content": {
                    "url": "https://www.youtube.com/watch?v=HF12-91iazM"
                },
            },
            {
                "page_type": "quiz",
                "content": {
                    "questions": [
                        {
                            "question": "Which command moves changes from the working directory to the staging area?",
                            "options": ["git commit", "git push", "git add", "git status"],
                            "correct_index": 2,
                        },
                        {
                            "question": "`git pull` is shorthand for which two commands?",
                            "options": [
                                "git fetch and git merge",
                                "git add and git commit",
                                "git clone and git checkout",
                                "git status and git log",
                            ],
                            "correct_index": 0,
                        },
                    ]
                },
            },
            {
                "page_type": "text",
                "content": {
                    "body": (
                        "The five commands you'll use daily\n\n"
                        "    git status\n\n"
                        "Tells you what's where. Which files changed in the "
                        "working directory? Which are staged? Run it "
                        "constantly. When in doubt, run `git status`.\n\n"
                        "    git add <file>\n\n"
                        "Moves changes from the working directory to the "
                        "staging area. `git add .` stages everything in the "
                        "current directory and below. Convenient, but easy to "
                        "accidentally stage files you didn't mean to. Prefer "
                        "`git add <specific-file>` until you trust your "
                        "`.gitignore`.\n\n"
                        "    git commit -m \"message\"\n\n"
                        "Creates a commit in the local repo. The message "
                        "should say *why* you made the change, not *what* the "
                        "change was. The diff already shows what.\n\n"
                        "    git push\n\n"
                        "Sends your local commits to the remote.\n\n"
                        "    git pull\n\n"
                        "Fetches changes from the remote and merges them into "
                        "your current branch. `git pull` is `git fetch` "
                        "followed by `git merge`, which is important to know "
                        "when the merge conflicts.\n\n"
                        "A commit is a *snapshot* of the whole repo, not a "
                        "diff. That is why `git show <hash>` can compute the "
                        "diff for you, and why switching branches is fast."
                    )
                },
            },
            _closing_page("Object-Oriented Programming, then Classes"),
        ],
    },
    {
        "subject": "Object-Oriented Programming",
        "title": "Classes, Objects, and `self` in Python",
        "description": (
            "The first thing most students get stuck on in OOP is `self`. "
            "This topic walks through what `self` actually is, how methods "
            "differ from functions, and why `__init__` exists."
        ),
        "is_published": True,
        "free_page_count": 2,
        "pages": [
            {
                "page_type": "text",
                "content": {
                    "body": (
                        "What a class is\n\n"
                        "A class is a *blueprint* for creating objects. An "
                        "*object* (or *instance*) is a specific thing made from "
                        "that blueprint. The class `Dog` describes what every "
                        "dog has (name, breed) and what every dog can do "
                        "(bark). Each individual dog (Fido, Rex, Luna) is an "
                        "*instance* of `Dog`, with its own specific name and "
                        "breed.\n\n"
                        "    class Dog:\n"
                        "        def __init__(self, name, breed):\n"
                        "            self.name = name\n"
                        "            self.breed = breed\n\n"
                        "        def bark(self):\n"
                        "            return f'{self.name} says woof'\n\n"
                        "    fido = Dog('Fido', 'Labrador')\n"
                        "    luna = Dog('Luna', 'Husky')\n"
                        "    print(fido.bark())   # 'Fido says woof'\n"
                        "    print(luna.bark())   # 'Luna says woof'\n\n"
                        "Two objects, same methods, different data."
                    )
                },
            },
            {
                "page_type": "quiz",
                "content": {
                    "questions": [
                        {
                            "question": "What is the relationship between a class and an object?",
                            "options": [
                                "A class is an instance of an object",
                                "An object is an instance of a class",
                                "They are the same thing",
                                "A class is a variable",
                            ],
                            "correct_index": 1,
                        },
                        {
                            "question": "In `fido = Dog('Fido', 'Labrador')`, what is `fido`?",
                            "options": [
                                "A class",
                                "A method",
                                "An instance of `Dog`",
                                "A parameter",
                            ],
                            "correct_index": 2,
                        },
                    ]
                },
            },
            {
                "page_type": "video",
                "content": {
                    "url": "https://www.youtube.com/watch?v=f0TrMH9s-VE"
                },
            },
            {
                "page_type": "quiz",
                "content": {
                    "questions": [
                        {
                            "question": "What is `self` inside a method?",
                            "options": [
                                "A keyword that Python reserves",
                                "A reference to the current instance",
                                "The class itself",
                                "A global variable",
                            ],
                            "correct_index": 1,
                        },
                        {
                            "question": "When you write `fido.bark()`, what does Python actually call?",
                            "options": [
                                "`bark()` with no arguments",
                                "`bark(fido)`",
                                "`Dog.bark()`",
                                "`bark(self=fido, this=self)`",
                            ],
                            "correct_index": 1,
                        },
                    ]
                },
            },
            {
                "page_type": "text",
                "content": {
                    "body": (
                        "What `self` actually is, and why `__init__` exists\n\n"
                        "When you call `fido.bark()`, you don't pass `self` "
                        "yourself. But `bark` is defined as `def bark(self): "
                        "...` with one parameter. Where does `self` come from?\n\n"
                        "Python passes it for you. `fido.bark()` is "
                        "essentially shorthand for `Dog.bark(fido)`. The `self` "
                        "inside the method *is* `fido`. That's it. `self` is "
                        "the instance the method was called on.\n\n"
                        "This means two things:\n\n"
                        "1. `self` is not a keyword. It's a convention. You "
                        "could name it `this` and Python wouldn't care. But "
                        "every Python programmer alive expects `self`, so "
                        "don't.\n\n"
                        "2. `self.name = name` inside `__init__` is what "
                        "creates the instance variable. Without `self.`, "
                        "`name = name` just reassigns the parameter to itself "
                        "and creates nothing.\n\n"
                        "`__init__` is the *initializer*. Python calls it "
                        "automatically when you write `Dog('Fido', 'Labrador')`. "
                        "Its job is to set up the instance's initial state, "
                        "usually by assigning `self.<attribute> = <value>` for "
                        "each attribute the instance needs.\n\n"
                        "The dunder methods (`__init__`, `__str__`, `__eq__`, "
                        "`__len__`) are hooks the language calls for you. You "
                        "rarely call them directly; you use the operator that "
                        "triggers them (`str(x)`, `x == y`, `len(x)`), and "
                        "Python dispatches to the right dunder."
                    )
                },
            },
            _closing_page("Operating Systems, then Processes"),
        ],
    },
    {
        "subject": "Operating Systems",
        "title": "Processes vs. Threads: The Difference That Matters",
        "description": (
            "Both let a program do more than one thing at a time. They differ "
            "in memory, isolation, and failure modes. This topic walks through "
            "the tradeoff with concrete examples."
        ),
        "is_published": True,
        "free_page_count": 2,
        "pages": [
            {
                "page_type": "text",
                "content": {
                    "body": (
                        "The one-sentence version\n\n"
                        "A **process** is a running program with its own "
                        "memory. A **thread** is a sequence of execution "
                        "*within* a process, sharing that process's memory "
                        "with other threads.\n\n"
                        "That's the whole distinction. Everything else (cost "
                        "of creation, isolation, failure modes) follows from "
                        "the memory sharing.\n\n"
                        "When you launch `python myscript.py`, the operating "
                        "system creates a process: a chunk of virtual memory, "
                        "a file descriptor table, a program counter, an ID "
                        "(PID), and a thread that starts executing at `main`. "
                        "If the script spawns a thread, that thread gets its "
                        "own program counter and stack but shares the process's "
                        "heap, file descriptors, and global data."
                    )
                },
            },
            {
                "page_type": "quiz",
                "content": {
                    "questions": [
                        {
                            "question": "What's the key difference between a process and a thread?",
                            "options": [
                                "Processes are faster",
                                "Threads share memory; processes don't",
                                "Only processes have PIDs",
                                "Threads are OS-level; processes are user-level",
                            ],
                            "correct_index": 1,
                        },
                        {
                            "question": "What does a thread share with other threads in the same process?",
                            "options": [
                                "Nothing",
                                "Only the stack",
                                "Memory, file descriptors, and global data",
                                "Only the program counter",
                            ],
                            "correct_index": 2,
                        },
                    ]
                },
            },
            {
                "page_type": "text",
                "content": {
                    "body": (
                        "Cost and isolation\n\n"
                        "Creating a process is expensive. The OS has to "
                        "allocate a new address space, copy or re-map parts of "
                        "the parent, set up file descriptors, and register a "
                        "new PID. On modern Linux, `fork()` is fast (the OS "
                        "uses copy-on-write tricks), but it's still "
                        "order-of-magnitude slower than creating a thread.\n\n"
                        "Creating a thread is cheap. It lives inside an "
                        "existing process, so it reuses the address space and "
                        "file descriptors. You can have thousands of threads "
                        "in one process without much overhead.\n\n"
                        "The tradeoff: threads share memory, processes don't. "
                        "That means:\n\n"
                        "- **Processes** are isolated. If one crashes, the OS "
                        "kills only that process. This is why browsers use one "
                        "process per tab: a tab crash doesn't take down the "
                        "browser.\n\n"
                        "- **Threads** are not isolated. A segfault in one "
                        "thread kills the whole process. This is why "
                        "multithreaded programming requires care."
                    )
                },
            },
            {
                "page_type": "quiz",
                "content": {
                    "questions": [
                        {
                            "question": "If one thread in a process segfaults, what happens?",
                            "options": [
                                "Only that thread dies",
                                "The whole process dies",
                                "The OS restarts the thread",
                                "Nothing",
                            ],
                            "correct_index": 1,
                        },
                        {
                            "question": "Why do browsers use one process per tab?",
                            "options": [
                                "To share memory between tabs",
                                "So a tab crash doesn't take down the browser",
                                "To make tabs load faster",
                                "Because threads cannot render HTML",
                            ],
                            "correct_index": 1,
                        },
                    ]
                },
            },
            {
                "page_type": "text",
                "content": {
                    "body": (
                        "When to use which\n\n"
                        "**Use processes when:**\n\n"
                        "- Tasks are CPU-bound (they need the CPU hot). Each "
                        "process gets its own CPU core in parallel.\n"
                        "- Tasks are independent or crash-prone. Isolation is "
                        "worth the overhead.\n"
                        "- You need to bypass the GIL in CPython (Python's "
                        "Global Interpreter Lock prevents true parallelism in "
                        "threads; `multiprocessing` sidesteps it).\n\n"
                        "**Use threads when:**\n\n"
                        "- Tasks are I/O-bound (network calls, file reads, "
                        "database queries). The GIL doesn't block I/O, so "
                        "threads parallelize I/O fine even in CPython.\n"
                        "- You need shared state. If two tasks need to read and "
                        "write the same data structure, threads make that easy "
                        "(though you still need locks).\n"
                        "- Thread startup cost matters. Spawning a thread is "
                        "cheap enough that you can do it per request.\n\n"
                        "The practical guidance for Python:\n\n"
                        "- I/O-bound: `threading` or `asyncio`\n"
                        "- CPU-bound: `multiprocessing` or "
                        "`concurrent.futures.ProcessPoolExecutor`"
                    )
                },
            },
            _closing_page("Computer Networks, then DNS"),
        ],
    },
    {
        "subject": "Computer Networks",
        "title": "DNS: How a Domain Name Becomes an IP",
        "description": (
            "You type `google.com` and your browser loads a page, but the "
            "internet only routes IP addresses. This topic walks through the "
            "DNS resolution chain and why caching is the whole performance "
            "story."
        ),
        "is_published": True,
        "free_page_count": 2,
        "pages": [
            {
                "page_type": "text",
                "content": {
                    "body": (
                        "What DNS is\n\n"
                        "DNS (Domain Name System) translates human-readable "
                        "names like `google.com` into IP addresses like "
                        "`142.250.72.196`. That's it. The whole system exists "
                        "so you don't have to memorize IP addresses.\n\n"
                        "It's tempting to think of DNS as a single database "
                        "somewhere. It isn't. DNS is a *distributed, "
                        "hierarchical* system. No single server knows every "
                        "name; instead, the answer is looked up by walking a "
                        "tree of servers that each know only a slice of the "
                        "namespace.\n\n"
                        "The tree looks like this:\n\n"
                        "    . (root)\n"
                        "    +-- com\n"
                        "    |   +-- google.com\n"
                        "    |       +-- www.google.com\n"
                        "    |       +-- mail.google.com\n"
                        "    +-- edu\n"
                        "        +-- basu.edu.ph\n\n"
                        "Each dot in `www.google.com` is a level in the tree. "
                        "Resolution starts at the root and walks down."
                    )
                },
            },
            {
                "page_type": "quiz",
                "content": {
                    "questions": [
                        {
                            "question": "What does DNS translate?",
                            "options": [
                                "IPs to MAC addresses",
                                "Domain names to IPs",
                                "URLs to ports",
                                "HTTPS to HTTP",
                            ],
                            "correct_index": 1,
                        },
                        {
                            "question": "Is DNS a single central server?",
                            "options": [
                                "Yes, run by ICANN",
                                "Yes, one per country",
                                "No, it is distributed and hierarchical",
                                "Only for .com domains",
                            ],
                            "correct_index": 2,
                        },
                    ]
                },
            },
            {
                "page_type": "video",
                "content": {
                    "url": "https://www.youtube.com/watch?v=72snZctFFtA"
                },
            },
            {
                "page_type": "quiz",
                "content": {
                    "questions": [
                        {
                            "question": "Which server actually returns the IP for `www.google.com`?",
                            "options": [
                                "The root server",
                                "The `.com` server",
                                "Google's authoritative nameserver",
                                "The recursive resolver",
                            ],
                            "correct_index": 2,
                        },
                        {
                            "question": "You changed your site's IP and the old one still loads for some users. Why?",
                            "options": [
                                "The change didn't propagate",
                                "DNS caching at multiple levels, until TTL expires",
                                "Their browsers are broken",
                                "DNS is broken",
                            ],
                            "correct_index": 1,
                        },
                    ]
                },
            },
            {
                "page_type": "text",
                "content": {
                    "body": (
                        "The resolution chain, and why caching matters\n\n"
                        "When you type `www.google.com`:\n\n"
                        "1. **Your OS** checks its local cache. If it has a "
                        "recent answer, done.\n\n"
                        "2. **Your OS** asks your configured *recursive "
                        "resolver* (often your ISP, or Cloudflare at `1.1.1.1`, "
                        "or Google at `8.8.8.8`).\n\n"
                        "3. **The resolver** asks a *root server*. Root servers "
                        "know nothing about Google, but they know who runs the "
                        "`.com` zone.\n\n"
                        "4. **The resolver** asks a `.com` server. Those know "
                        "which nameservers are authoritative for `google.com`.\n\n"
                        "5. **The resolver** asks Google's nameserver, which "
                        "returns the IP.\n\n"
                        "6. **The resolver** caches the answer for the TTL "
                        "(time-to-live), then returns it to your OS, which "
                        "also caches it, then to your browser.\n\n"
                        "Without caching, every HTTP request would trigger six "
                        "round trips before the browser even opens a TCP "
                        "connection. Caching happens at every level: browser "
                        "(1-2 minutes), OS (minutes to hours), recursive "
                        "resolver (governed by TTL, often 5 minutes to 24 "
                        "hours).\n\n"
                        "When you're about to migrate a site, the standard "
                        "play is: reduce the TTL to 300 a day before, do the "
                        "migration, then raise it back."
                    )
                },
            },
            _closing_page("Python, then Functions"),
        ],
    },
]


class Command(BaseCommand):
    help = (
        "Seeds a set of demo Topics authored by one user. "
        "Idempotent: re-running updates existing topics (by owner + title) "
        "and replaces their pages."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "--username",
            type=str,
            default=None,
            help=(
                "Username to author the topics as. If omitted, uses the first "
                "superuser (or the first user in the DB)."
            ),
        )

    def handle(self, *args, **options):
        tutor = self._resolve_tutor(options["username"])
        self.stdout.write(
            self.style.NOTICE(f"Seeding topics authored by: {tutor.username}")
        )

        created_count = 0
        updated_count = 0

        with transaction.atomic():
            for topic_def in TOPICS:
                try:
                    subject = Subject.objects.get(name=topic_def["subject"])
                except Subject.DoesNotExist:
                    raise CommandError(
                        f"Subject '{topic_def['subject']}' does not exist. "
                        "Run `python manage.py seed_subjects` first."
                    )

                topic, created = Topic.objects.get_or_create(
                    created_by=tutor,
                    title=topic_def["title"],
                    defaults={
                        "subject": subject,
                        "description": topic_def["description"],
                        "is_published": topic_def["is_published"],
                        "free_page_count": topic_def["free_page_count"],
                    },
                )

                if created:
                    created_count += 1
                    self.stdout.write(
                        self.style.SUCCESS(f"  + Created: {topic.title}")
                    )
                else:
                    topic.subject = subject
                    topic.description = topic_def["description"]
                    topic.is_published = topic_def["is_published"]
                    topic.free_page_count = topic_def["free_page_count"]
                    topic.save(
                        update_fields=[
                            "subject",
                            "description",
                            "is_published",
                            "free_page_count",
                        ]
                    )
                    topic.pages.all().delete()
                    updated_count += 1
                    self.stdout.write(
                        self.style.WARNING(f"  ~ Updated: {topic.title}")
                    )

                for order, page_def in enumerate(topic_def["pages"], start=1):
                    TopicPage.objects.create(
                        topic=topic,
                        order=order,
                        page_type=page_def["page_type"],
                        content=page_def["content"],
                    )

        self.stdout.write("")
        self.stdout.write(
            self.style.SUCCESS(
                f"Done. Created {created_count}, updated {updated_count}. "
                f"Total topics: {Topic.objects.filter(created_by=tutor).count()}."
            )
        )

    def _resolve_tutor(self, username):
        if username:
            try:
                return User.objects.get(username=username)
            except User.DoesNotExist:
                raise CommandError(f"User '{username}' does not exist.")

        tutor = User.objects.filter(is_superuser=True).order_by("id").first()
        if tutor:
            return tutor
        tutor = User.objects.order_by("id").first()
        if not tutor:
            raise CommandError(
                "No users exist. Create a user first, or pass --username."
            )
        return tutor