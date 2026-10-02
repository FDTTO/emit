"""Merge the coverage of every suite run and list what no scenario reached.

Each run of `verify.py --suite --coverage` leaves a `.coverage.json` beside its
log: the style rules of the theme and its parts with whether each was ever
applied, and the functions of the page's scripts with how often each ran. A rule applied or a function run
in any one run counts as reached. What is left was never exercised by any
scenario, so no check can be protecting it: either the code is dead, or a
state of the page has no scenario yet.
"""
import glob
import json
import os
import re

COMMENT = re.compile(r"/\*.*?\*/", re.S)
STYLE_BLOCK = re.compile(r"[^{}@;]+\{[^{}]*\}")
KEYFRAMES = re.compile(r"@keyframes[^{]*\{")


def style_rules(css):
    """Start offsets of every style rule's selector, nested ones included.

    The browser reports only the rules it applied, so the total has to come
    from the stylesheet itself. Comments are blanked to the same length first
    (they quote stock rules, braces and all), and keyframe steps are skipped
    because they are not style rules.
    """
    masked = COMMENT.sub(lambda match: " " * len(match.group(0)), css)
    keyframes = []
    for match in KEYFRAMES.finditer(masked):
        depth, position = 1, match.end()
        while depth and position < len(masked):
            depth += {"{": 1, "}": -1}.get(masked[position], 0)
            position += 1
        keyframes.append((match.start(), position))
    starts = []
    for match in STYLE_BLOCK.finditer(masked):
        text = match.group(0)
        start = match.start() + len(text) - len(text.lstrip())
        if not any(begin <= start < end for begin, end in keyframes):
            starts.append(start)
    return starts


def _line(text, offset):
    return text.count("\n", 0, offset) + 1


def _selector(text, start):
    brace = text.find("{", start)
    return " ".join(text[start:brace].split())[:110]


def merge(coverage_files):
    applied, functions = set(), {}
    for path in coverage_files:
        with open(path, encoding="utf-8") as source:
            data = json.load(source)
        applied.update((file, start) for file, start, _, used in data["rules"] if used)
        for file, name, start, end, count in data["functions"]:
            key = (file, name, start, end)
            functions[key] = max(functions.get(key, 0), count)
    return applied, functions


def stylesheets(static_dir):
    """Every stylesheet of the page, read from disk rather than from the runs,
    so a part no run loaded still counts, as entirely unreached."""
    paths = (glob.glob(os.path.join(static_dir, "*.css"))
             + glob.glob(os.path.join(static_dir, "console", "**", "*.css"), recursive=True))
    return sorted(os.path.relpath(path, static_dir).replace(os.sep, "/") for path in paths)


def _read(static_dir, file):
    with open(os.path.join(static_dir, file), encoding="utf-8", newline="") as source:
        return source.read()


def report(coverage_files, static_dir):
    """Prints the unreached rules and functions; returns how many there are.

    Both are reported per file under static_dir: the theme and its parts,
    the page's entry and the console's modules."""
    if not coverage_files:
        print("coverage: no run produced coverage")
        return 0
    applied, functions = merge(coverage_files)
    # The harness publishes its own script beside the page for a run and
    # removes it after; only what ships is reported.
    functions = {key: count for key, count in functions.items()
                 if os.path.exists(os.path.join(static_dir, key[0]))}
    sources = {}
    for file in stylesheets(static_dir) + [key[0] for key in functions]:
        if file not in sources:
            sources[file] = _read(static_dir, file)

    rules = sorted((file, start) for file in stylesheets(static_dir) for start in style_rules(sources[file]))
    unused_rules = [rule for rule in rules if rule not in applied]
    # A module's outermost range is the module itself, not a function.
    named = {key: count for key, count in functions.items() if key[2] > 0}
    unrun = sorted((file, start, name) for (file, name, start, _), count in named.items() if count == 0)

    print(f"\ncoverage across {len(coverage_files)} runs")
    print(f"  theme       {len(rules) - len(unused_rules)} of {len(rules)} rules applied at least once")
    print(f"  console     {len(named) - len(unrun)} of {len(named)} functions in {len({key[0] for key in named})} modules ran at least once")
    if unused_rules:
        print("\n  rules never applied:")
        for file, start in unused_rules:
            print(f"    {file}:{_line(sources[file], start):<5} {_selector(sources[file], start)}")
    if unrun:
        print("\n  functions never run:")
        for file, start, name in unrun:
            print(f"    {file}:{_line(sources[file], start):<5} {name or '(anonymous)'}")
    return len(unused_rules) + len(unrun)


def coverage_files(directory):
    return sorted(os.path.join(directory, name) for name in os.listdir(directory)
                  if name.endswith(".coverage.json"))
