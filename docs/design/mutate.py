"""Break enhance.js one function at a time and see whether the suite notices.

    python docs/design/verify.py --suite --coverage      # once, to map coverage
    python docs/design/mutate.py [--only name,name] [--sample N] [--seed S]

Each mutant knocks one named function out, with a `return;` as its first
statement, publishes it in place of the served enhance.js and runs only the
scenarios whose coverage shows that function running: a scenario that never
calls it cannot catch it. A failing run means the mutant was killed: some
check depends on that function. A green run means it survived: the function
could stop working and the suite would stay green.

The served script is restored after every mutant, and on any exit.
"""
import argparse
import json
import os
import random
import re
import subprocess
import sys

import coverage_report
from verify import OUT, STATIC

HERE = os.path.dirname(os.path.abspath(__file__))
SCRIPT = os.path.join(STATIC, "enhance.js")
NAMED = re.compile(r"^  function (\w+)\(", re.M)


def functions(source):
    """Named functions with the offset V8 reports for them."""
    return [(match.group(1), match.start() + 2) for match in NAMED.finditer(source)]


def scenarios_running(coverage_files, offset):
    """Scenario stems where the function at this offset ran at least once."""
    stems = set()
    for path in coverage_files:
        with open(path, encoding="utf-8") as source:
            data = json.load(source)
        if any(start == offset and count > 0 for _, start, _, count in data["functions"]):
            stems.add(os.path.basename(path).rsplit("-", 1)[0])
    return sorted(stems)


def knock_out(source, offset):
    brace = source.index("{", offset)
    return source[:brace + 1] + " return;" + source[brace + 1:]


def run_suite(stems):
    done = subprocess.run([sys.executable, os.path.join(HERE, "verify.py"), "--suite", "--only", ",".join(stems)],
                          capture_output=True, text=True)
    failed = [line for line in done.stdout.splitlines() if line.startswith("FAIL")]
    return done.returncode != 0, failed


def main():
    parser = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    parser.add_argument("--only", help="function names to mutate, comma-separated")
    parser.add_argument("--sample", type=int, help="mutate a random sample of this many covered functions")
    parser.add_argument("--seed", type=int, default=1)
    args = parser.parse_args()
    sys.stdout.reconfigure(encoding="utf-8")

    coverage_files = coverage_report.coverage_files(OUT)
    if not coverage_files:
        sys.exit("No coverage yet: run verify.py --suite --coverage first.")
    with open(SCRIPT, encoding="utf-8", newline="") as source:
        original = source.read()

    targets = functions(original)
    if args.only:
        wanted = set(args.only.split(","))
        targets = [t for t in targets if t[0] in wanted]
    covered = [(name, offset, scenarios_running(coverage_files, offset)) for name, offset in targets]
    uncovered = [name for name, _, stems in covered if not stems]
    covered = [entry for entry in covered if entry[2]]
    if args.sample and args.sample < len(covered):
        covered = random.Random(args.seed).sample(covered, args.sample)

    results = []
    try:
        for name, offset, stems in covered:
            with open(SCRIPT, "w", encoding="utf-8", newline="") as target:
                target.write(knock_out(original, offset))
            killed, failed = run_suite(stems)
            results.append((name, killed, stems, failed))
            print(f"{'KILLED  ' if killed else 'SURVIVED'} {name:<28} by {', '.join(stems)}"
                  + (f"  ({failed[0].split()[1]} failed)" if failed else ""), flush=True)
    finally:
        with open(SCRIPT, "w", encoding="utf-8", newline="") as target:
            target.write(original)

    killed = sum(1 for _, was_killed, _, _ in results if was_killed)
    if results:
        print(f"\n{killed} of {len(results)} mutants killed ({100 * killed // len(results)}%)")
    survivors = [name for name, was_killed, _, _ in results if not was_killed]
    if survivors:
        print("survived, so no check depends on them: " + ", ".join(survivors))
    if uncovered:
        print("not run by any scenario, so not mutated: " + ", ".join(uncovered))


if __name__ == "__main__":
    main()
