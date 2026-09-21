"""Merge the coverage of every suite run and list what no scenario reached.

Each run of `verify.py --suite --coverage` leaves a `.coverage.json` beside its
log: the theme's style rules with whether each was ever applied, and the page
script's functions with how often each ran. A rule applied or a function run
in any one run counts as reached. What is left was never exercised by any
scenario, so no check can be protecting it: either the code is dead, or a
state of the page has no scenario yet.
"""
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
        applied.update(start for start, _, used in data["rules"] if used)
        for name, start, end, count in data["functions"]:
            functions[(name, start, end)] = max(functions.get((name, start, end), 0), count)
    return applied, functions


def report(coverage_files, theme_path, script_path):
    """Prints the unreached rules and functions; returns how many there are."""
    if not coverage_files:
        print("coverage: no run produced coverage")
        return 0
    applied, functions = merge(coverage_files)
    with open(theme_path, encoding="utf-8", newline="") as theme:
        css = theme.read()
    with open(script_path, encoding="utf-8", newline="") as script:
        js = script.read()

    rules = style_rules(css)
    unused_rules = [start for start in rules if start not in applied]
    # The outermost range is the script itself, not a function.
    named = {key: count for key, count in functions.items() if key[1] > 0}
    unrun = sorted((start, name) for (name, start, _), count in named.items() if count == 0)

    print(f"\ncoverage across {len(coverage_files)} runs")
    print(f"  theme.css   {len(rules) - len(unused_rules)} of {len(rules)} rules applied at least once")
    print(f"  enhance.js  {len(named) - len(unrun)} of {len(named)} functions ran at least once")
    if unused_rules:
        print("\n  rules never applied:")
        for start in unused_rules:
            print(f"    theme.css:{_line(css, start):<5} {_selector(css, start)}")
    if unrun:
        print("\n  functions never run:")
        for start, name in unrun:
            print(f"    enhance.js:{_line(js, start):<5} {name or '(anonymous)'}")
    return len(unused_rules) + len(unrun)


def coverage_files(directory):
    return sorted(os.path.join(directory, name) for name in os.listdir(directory)
                  if name.endswith(".coverage.json"))
