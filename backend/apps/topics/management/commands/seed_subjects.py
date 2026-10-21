from django.core.management.base import BaseCommand
from apps.topics.models import Subject

SUBJECTS = [
    "Python", "Java", "C++", "C#", "JavaScript", "TypeScript", "Go", "Rust",
    "Data Structures", "Algorithms", "Discrete Mathematics", "Linear Algebra",
    "Web Development", "Mobile Development", "Game Development", 
    "Frontend Development", "Backend Development", "Full-Stack Development",
    "Database Management", "SQL", "NoSQL", 
    "Operating Systems", "Computer Networks", "Cybersecurity", 
    "Software Engineering", "Object-Oriented Programming", "Functional Programming",
    "Artificial Intelligence", "Machine Learning", "Deep Learning", 
    "Data Science", "Data Analysis", "Computer Graphics", "Human-Computer Interaction",
    "Cloud Computing", "DevOps", "Version Control (Git)"
]

class Command(BaseCommand):
    help = "Seeds the database with common CS subjects"

    def handle(self, *args, **options):
        created_count = 0
        for name in SUBJECTS:
            subject, created = Subject.objects.get_or_create(name=name)
            if created:
                created_count += 1
                self.stdout.write(self.style.SUCCESS(f"Created subject: {name}"))
        
        self.stdout.write(self.style.SUCCESS(f"\nDone! Created {created_count} new subjects."))