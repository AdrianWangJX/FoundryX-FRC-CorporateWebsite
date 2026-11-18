"""Materialize the pinned FRC videos without storing large binaries in Git."""

import hashlib
import json
import os
from pathlib import Path
from tempfile import NamedTemporaryFile
from urllib.request import urlopen

ORIGIN = 'https://foundryx.xyz/assets/'
BLOCK_SIZE = 1024 * 1024


def matches(path, record):
    if not path.is_file() or path.stat().st_size != record['size']:
        return False
    digest = hashlib.sha256()
    with path.open('rb') as source:
        for block in iter(lambda: source.read(BLOCK_SIZE), b''):
            digest.update(block)
    return digest.hexdigest() == record['sha256']


def copy_verified(source, destination, record):
    """Publish an intact file atomically, including when two builds overlap."""
    destination.parent.mkdir(parents=True, exist_ok=True)
    with NamedTemporaryFile(dir=destination.parent, delete=False) as temp:
        temporary = Path(temp.name)
    try:
        digest = hashlib.sha256()
        size = 0
        with temporary.open('wb') as output:
            for block in iter(lambda: source.read(BLOCK_SIZE), b''):
                output.write(block)
                digest.update(block)
                size += len(block)
        if size != record['size'] or digest.hexdigest() != record['sha256']:
            raise ValueError(f'Video checksum mismatch: {destination.name}')
        temporary.chmod(0o644)
        temporary.replace(destination)
    finally:
        temporary.unlink(missing_ok=True)


def install_media(source_dir, output_dir):
    records = json.loads((source_dir / 'media-manifest.json').read_text())
    mirror = os.environ.get('FOUNDRYX_MEDIA_DIR')
    for name, record in records.items():
        destination = output_dir / 'assets' / name
        if matches(destination, record):
            continue
        local = (Path(mirror) if mirror else source_dir / 'published-welcome') / name
        if mirror or local.is_file():
            with local.open('rb') as source:
                copy_verified(source, destination, record)
        else:
            print(f'Fetching {name}', flush=True)
            with urlopen(ORIGIN + name, timeout=90) as source:
                copy_verified(source, destination, record)
