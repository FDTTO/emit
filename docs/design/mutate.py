"""Break the console one function at a time and see whether the suite notices.

    python docs/design/verify.py --suite --coverage      # once, to map coverage
    python docs/design/mutate.py [--only name,name] [--sample N] [--seed S]

Each mutant knocks one named function of the console's modules out, with a
`return;` as its first statement, publishes the module in place of the served
one and runs only the scenarios whose coverage shows that function running: a
scenario that never calls it cannot catch it. A failing run means the mutant
was killed: some check depends on that function. A green run means it
survived: the function could stop working and the suite would stay green.

The served module is restored after every mutant, and on any exit.
"""
import argparse
import glob
import json
import os
import random
import re
import subprocess
import sys

import coverage_report
from verify import OUT, STATIC

HERE = os.path.dirname(os.path.abspath(__file__))
NAMED = re.compile(r"^(?:export )?(function (\w+)\()", re.M)


def modules():
    """The page's entry and the console's modules, as paths relative to STATIC."""
    paths = sorted(glob.glob(os.path.join(STATIC, "console", "*.js"))) + [os.path.join(STATIC, "emit.js")]
    return [os.path.relpath(path, STATIC).replace(os.sep, "/") for path in paths]


def functions(file, source):
    """Named top-level functions with the offset V8 reports for them."""
    return [(file, match.group(2), match.start(1)) for match in NAMED.finditer(source)]


def scenarios_running(coverage_files, file, offset):
    """Scenario stems where the function at this offset of this file ran at least once."""
    stems = set()
    for path in coverage_files:
        with open(path, encoding="utf-8") as source:
            data = json.load(source)
        if any(f == file and start == offset and count > 0 for f, _, start, _, count in data["functions"]):
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
    originals = {}
    for file in modules():
        with open(os.path.join(STATIC, file), encoding="utf-8", newline="") as source:
            originals[file] = source.read()

    targets = [t for file, text in originals.items() for t in functions(file, text)]
    if args.only:
        wanted = set(args.only.split(","))
        targets = [t for t in targets if t[1] in wanted]
    covered = [(file, name, offset, scenarios_running(coverage_files, file, offset)) for file, name, offset in targets]
    uncovered = [file + ":" + name for file, name, _, stems in covered if not stems]
    covered = [entry for entry in covered if entry[3]]
    if args.sample and args.sample < len(covered):
        covered = random.Random(args.seed).sample(covered, args.sample)

    results = []
    try:
        for file, name, offset, stems in covered:
            with open(os.path.join(STATIC, file), "w", encoding="utf-8", newline="") as target:
                target.write(knock_out(originals[file], offset))
            try:
                killed, failed = run_suite(stems)
            finally:
                with open(os.path.join(STATIC, file), "w", encoding="utf-8", newline="") as target:
                    target.write(originals[file])
            results.append((name, killed, stems, failed))
            print(f"{'KILLED  ' if killed else 'SURVIVED'} {file + ':' + name:<40} by {', '.join(stems)}"
                  + (f"  ({failed[0].split()[1]} failed)" if failed else ""), flush=True)
    finally:
        for file, text in originals.items():
            with open(os.path.join(STATIC, file), "w", encoding="utf-8", newline="") as target:
                target.write(text)

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
