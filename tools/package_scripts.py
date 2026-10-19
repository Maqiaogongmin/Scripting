"""Build a Scripting import ZIP containing only runtime source files."""
import argparse
import json
from pathlib import Path
import zipfile

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('script', help='Directory name under scripts/')
args = parser.parse_args()
root = Path(__file__).resolve().parents[1]
source = (root / 'scripts' / args.script).resolve()
if source.parent != (root / 'scripts').resolve() or not source.is_dir():
    parser.error('Choose a script directory directly under scripts/')
metadata = json.loads((source / 'script.json').read_text())
for key in ('name', 'version', 'icon', 'color'):
    if not metadata.get(key):
        parser.error(f'Missing script.json field: {key}')
if not (source / 'index.tsx').is_file():
    parser.error('Missing index.tsx')
files = sorted(p for p in source.rglob('*') if p.is_file()
               and not any(part.startswith('.') or part == 'node_modules'
                           for part in p.relative_to(source).parts)
               and (p.suffix in ('.ts', '.tsx') or p.name == 'script.json'))
output = root / 'dist' / (source.name + '.zip')
output.parent.mkdir(exist_ok=True)
with zipfile.ZipFile(output, 'w', zipfile.ZIP_DEFLATED) as archive:
    for file in files:
        archive.write(file, file.relative_to(source))
with zipfile.ZipFile(output) as archive:
    assert archive.testzip() is None
print(f'{metadata["name"]} v{metadata["version"]}: {len(files)} files -> {output}')
