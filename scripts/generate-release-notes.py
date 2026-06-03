#!/usr/bin/env python3
"""
Generate GitHub release notes from merged pull requests.

Fetches merged PRs between tags using GitHub API and formats as markdown.
Much simpler and cleaner than parsing commits.
"""

import subprocess
import sys
import re
import argparse
import json
from typing import List, Dict, Optional
from dataclasses import dataclass
from urllib import request, error

# Category mapping from PR labels to display names
LABEL_CATEGORIES = {
    "feature": "✨ Features",
    "enhancement": "✨ Features",
    "bug": "🐛 Bug Fixes",
    "bugfix": "🐛 Bug Fixes",
    "fix": "🐛 Bug Fixes",
    "performance": "⚡ Performance",
    "documentation": "📚 Documentation",
    "docs": "📚 Documentation",
    "refactor": "♻️ Refactoring",
    "test": "✅ Tests",
    "ci": "👷 CI/CD",
    "chore": "🔧 Chores",
}

@dataclass
class PullRequest:
    """Structured representation of a GitHub PR."""
    number: int
    title: str
    url: str
    labels: List[str]
    category: str = "other"


class ReleaseNotesGenerator:
    """Generates release notes from GitHub PRs."""

    def __init__(self, version: str, repo_url: str, docs_url: str):
        """
        Initialize the release notes generator.

        Args:
            version: The release version tag (e.g., v0.3.0-beta)
            repo_url: GitHub repository URL
            docs_url: Documentation URL to include in footer
        """
        self.version = version
        self.repo_url = repo_url.rstrip('/')
        self.docs_url = docs_url

        # Extract owner/repo from URL
        match = re.search(r'github\.com/([^/]+)/([^/]+)', repo_url)
        if not match:
            raise ValueError(f"Invalid GitHub URL: {repo_url}")

        self.owner = match.group(1)
        self.repo = match.group(2)

    def _find_previous_tag(self) -> Optional[str]:
        """Find the previous release tag before current version."""
        try:
            result = subprocess.run(
                ['git', 'describe', '--tags', '--abbrev=0', f'{self.version}^'],
                capture_output=True,
                text=True,
                check=True
            )
            return result.stdout.strip()
        except subprocess.CalledProcessError:
            return None

    def _get_date_for_tag(self, tag: str) -> Optional[str]:
        """Get ISO date for a git tag."""
        try:
            result = subprocess.run(
                ['git', 'log', '-1', '--format=%aI', tag],
                capture_output=True,
                text=True,
                check=True
            )
            return result.stdout.strip()
        except subprocess.CalledProcessError:
            return None

    def _fetch_merged_prs(self, since_date: Optional[str]) -> List[PullRequest]:
        """
        Fetch merged PRs from GitHub API.

        Args:
            since_date: ISO date to fetch PRs from (None = all PRs)

        Returns:
            List of PullRequest objects
        """
        # Build GitHub API URL
        api_url = f"https://api.github.com/repos/{self.owner}/{self.repo}/pulls"
        params = "state=closed&sort=updated&direction=desc&per_page=100"

        if since_date:
            params += f"&since={since_date}"

        url = f"{api_url}?{params}"

        try:
            req = request.Request(url)
            req.add_header('Accept', 'application/vnd.github.v3+json')

            with request.urlopen(req) as response:
                data = json.loads(response.read().decode())

            prs = []
            for pr_data in data:
                # Only include merged PRs
                if not pr_data.get('merged_at'):
                    continue

                # Extract labels
                labels = [label['name'].lower() for label in pr_data.get('labels', [])]

                # Determine category from labels
                category = "other"
                for label in labels:
                    if label in LABEL_CATEGORIES:
                        category = label
                        break

                pr = PullRequest(
                    number=pr_data['number'],
                    title=pr_data['title'],
                    url=pr_data['html_url'],
                    labels=labels,
                    category=category
                )
                prs.append(pr)

            return prs

        except error.URLError as e:
            print(f"WARNING: Could not fetch PRs from GitHub API: {e}", file=sys.stderr)
            print("INFO: Falling back to git log", file=sys.stderr)
            return self._fallback_prs_from_git()
        except Exception as e:
            print(f"WARNING: Error fetching PRs: {e}", file=sys.stderr)
            return self._fallback_prs_from_git()

    def _fallback_prs_from_git(self) -> List[PullRequest]:
        """
        Fallback: extract PR numbers from git commit messages.

        Returns:
            List of PullRequest objects (with minimal info)
        """
        previous_tag = self._find_previous_tag()

        if previous_tag:
            commit_range = f'{previous_tag}..{self.version}'
        else:
            commit_range = self.version

        try:
            result = subprocess.run(
                ['git', 'log', '--format=%s', '--no-merges', commit_range],
                capture_output=True,
                text=True,
                check=True
            )

            prs = []
            seen = set()

            for line in result.stdout.split('\n'):
                # Extract PR number from commit message
                match = re.search(r'#(\d+)', line)
                if match:
                    pr_number = int(match.group(1))

                    # Avoid duplicates
                    if pr_number in seen:
                        continue
                    seen.add(pr_number)

                    # Use commit subject as title (fallback)
                    title = re.sub(r'\s*\(#\d+\)\s*$', '', line).strip()

                    pr = PullRequest(
                        number=pr_number,
                        title=title,
                        url=f"{self.repo_url}/pull/{pr_number}",
                        labels=[],
                        category="other"
                    )
                    prs.append(pr)

            return prs

        except subprocess.CalledProcessError:
            return []

    def _categorize_prs(self, prs: List[PullRequest]) -> Dict[str, List[PullRequest]]:
        """
        Group PRs by category.

        Args:
            prs: List of PullRequest objects

        Returns:
            Dictionary mapping category to list of PRs
        """
        categorized: Dict[str, List[PullRequest]] = {}

        for pr in prs:
            category = pr.category

            if category not in categorized:
                categorized[category] = []

            categorized[category].append(pr)

        return categorized

    def _format_pr(self, pr: PullRequest) -> str:
        """
        Format a PR as a markdown list item.

        Args:
            pr: PullRequest object

        Returns:
            Markdown-formatted string
        """
        return f"- {pr.title} [#{pr.number}]({pr.url})"

    def _generate_changelog_section(self, categorized: Dict[str, List[PullRequest]]) -> str:
        """
        Generate the "What's Changed" markdown section.

        Args:
            categorized: Dictionary of PRs grouped by category

        Returns:
            Markdown-formatted changelog
        """
        if not categorized:
            return "## What's Changed\n\nNo changes in this release.\n"

        sections = ["## What's Changed\n"]

        # Add sections in order (features, bugs, etc.)
        for label, display_name in LABEL_CATEGORIES.items():
            if label in categorized:
                sections.append(f"### {display_name}\n")

                for pr in categorized[label]:
                    sections.append(self._format_pr(pr))

                sections.append("")  # Blank line after each category

        # Add "Other Changes" section
        if "other" in categorized:
            sections.append("### 🔀 Other Changes\n")
            for pr in categorized["other"]:
                sections.append(self._format_pr(pr))
            sections.append("")

        return "\n".join(sections)

    def _generate_footer(self) -> str:
        """Generate footer with documentation link."""
        return f"---\n\n**Documentation**: {self.docs_url}\n"

    def generate(self) -> str:
        """
        Main entry point: generate complete release notes.

        Returns:
            Complete markdown release notes
        """
        # Find previous tag
        previous_tag = self._find_previous_tag()

        if previous_tag:
            print(f"INFO: Generating changelog from {previous_tag} to {self.version}", file=sys.stderr)
            since_date = self._get_date_for_tag(previous_tag)
        else:
            print(f"INFO: No previous tag found. Using all PRs", file=sys.stderr)
            since_date = None

        # Fetch merged PRs
        prs = self._fetch_merged_prs(since_date)

        if not prs:
            print("INFO: No PRs found in range.", file=sys.stderr)
            return f"## What's Changed\n\nNo changes in this release.\n\n{self._generate_footer()}"

        print(f"INFO: Found {len(prs)} merged PRs", file=sys.stderr)

        # Categorize PRs
        categorized = self._categorize_prs(prs)

        # Generate changelog
        changelog = self._generate_changelog_section(categorized)

        # Append footer
        footer = self._generate_footer()

        return f"{changelog}\n{footer}"


def main():
    """CLI entry point."""
    parser = argparse.ArgumentParser(
        description="Generate GitHub release notes from merged pull requests"
    )
    parser.add_argument(
        "--version",
        required=True,
        help="Release version tag (e.g., v0.3.0-beta)"
    )
    parser.add_argument(
        "--repo-url",
        required=True,
        help="GitHub repository URL (e.g., https://github.com/org/repo)"
    )
    parser.add_argument(
        "--docs-url",
        required=True,
        help="Documentation URL to include in footer"
    )

    args = parser.parse_args()

    try:
        generator = ReleaseNotesGenerator(args.version, args.repo_url, args.docs_url)
        release_notes = generator.generate()
        print(release_notes)
        sys.exit(0)
    except Exception as e:
        print(f"ERROR: Failed to generate release notes: {e}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
