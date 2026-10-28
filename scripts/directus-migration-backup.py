"""Operator-only backup/restore rehearsal. Run on the Docker host, never in app startup.

No production writes, deletes, networked clones, cron or automatic retention.
Backups contain personal data and must remain outside Git and web roots.
"""
import argparse
import hashlib
import json
import os
from pathlib import Path
import secrets
import shutil
import subprocess
import tarfile
import time

ROOT = Path('/srv/built-migration/backups')
UPLOADS = Path('/srv/captain/directus-appbuiltalliances/uploads')
SOURCES = (
    ('directus', 'srv-captain--pg-appbuiltalliances.', 'appbuiltalliances_directus', 'postgres:17-alpine'),
    ('application', 'srv-captain--built-postgres.', 'built_alliances', 'postgres:16'),
)

def run(args, **kwargs):
    result = subprocess.run(args, capture_output=True, timeout=kwargs.pop('timeout', 120), **kwargs)
    if result.returncode:
        # Do not print stderr: provider/SQL output can contain credentials or rows.
        raise RuntimeError('Command failed: ' + args[0])
    return result.stdout

def container(prefix):
    ids = run(['docker', 'ps', '--filter', 'name=' + prefix, '--format', '{{.ID}}']).decode().splitlines()
    if len(ids) != 1:
        raise RuntimeError('Ambiguous database container')
    info = json.loads(run(['docker', 'inspect', ids[0]]))[0]
    env = dict(item.split('=', 1) for item in info['Config']['Env'] if '=' in item)
    return ids[0], env.get('POSTGRES_USER', 'postgres')

def digest(path):
    h = hashlib.sha256()
    with path.open('rb') as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b''):
            h.update(block)
    return h.hexdigest()

def file_inventory(root):
    result = {}
    for path in sorted(root.rglob('*')):
        if path.is_symlink():
            raise RuntimeError('Symlinks require explicit migration review')
        if path.is_file():
            result[path.relative_to(root).as_posix()] = {'bytes': path.stat().st_size, 'sha256': digest(path)}
    return result

def verify_archive(archive, expected):
    found = {}
    with tarfile.open(archive, 'r:gz') as tar:
        for member in tar:
            if not member.isfile() or member.name not in expected or member.name in found:
                raise RuntimeError('Unexpected archive member')
            stream = tar.extractfile(member)
            h = hashlib.sha256()
            for block in iter(lambda: stream.read(1024 * 1024), b''):
                h.update(block)
            found[member.name] = {'bytes': member.size, 'sha256': h.hexdigest()}
    if found != expected:
        raise RuntimeError('File checksum mismatch')

def fresh_directory(root, run_id):
    if not run_id or any(c not in '0123456789abcdefghijklmnopqrstuvwxyz-' for c in run_id):
        raise ValueError('Invalid run ID')
    path = root / run_id
    path.mkdir(mode=0o700, parents=False, exist_ok=False)
    return path

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--backup-and-rehearse', action='store_true')
    args = parser.parse_args()
    if not args.backup_and_rehearse:
        parser.error('Explicit --backup-and-rehearse required')
    if os.name != 'posix' or os.geteuid() != 0:
        raise RuntimeError('Run as operator on the Linux Docker host')
    os.umask(0o077)
    if not UPLOADS.is_dir() or UPLOADS.is_symlink():
        raise RuntimeError('Missing or unexpected uploads directory')
    ROOT.mkdir(mode=0o700, parents=True, exist_ok=True)
    if ROOT.is_symlink():
        raise RuntimeError('Unexpected backup root')
    os.chmod(ROOT, 0o700)
    if shutil.disk_usage(ROOT).free < 3 * 1024**3:
        raise RuntimeError('Less than 3 GiB free: no backup started')
    run_id = time.strftime('%Y%m%dT%H%M%S', time.gmtime()).lower() + '-' + secrets.token_hex(4)
    destination = fresh_directory(ROOT, run_id)
    report = {'run': run_id, 'state': 'incomplete', 'sourceWrites': False,
              'productionCutover': False, 'retention': 'manual-only-no-expiry', 'databases': {}, 'files': {}}
    active = None
    try:
        for label, prefix, database, image in SOURCES:
            cid, user = container(prefix)
            backup = destination / (label + '.dump')
            with backup.open('xb') as output:
                proc = subprocess.run(['docker', 'exec', '-e', 'PGOPTIONS=-c default_transaction_read_only=on', cid,
                    'pg_dump', '-U', user, '-d', database, '--format=custom'],
                    stdout=output, stderr=subprocess.PIPE, timeout=600)
            if proc.returncode or not backup.stat().st_size:
                raise RuntimeError('Backup failed: ' + label)
            clone = 'built-migration-verify-' + label + '-' + run_id
            run(['docker', 'image', 'inspect', image])  # no implicit image pull
            run(['docker', 'create', '--name', clone, '--network', 'none', '--restart', 'no',
                 '--label', 'built.migration.run=' + run_id,
                 '--memory', '1g', '--cpus', '1', '-e', 'POSTGRES_HOST_AUTH_METHOD=trust', image])
            active = clone
            run(['docker', 'start', clone])
            for attempt in range(30):
                ready = subprocess.run(['docker', 'exec', clone, 'pg_isready', '-U', 'postgres'], capture_output=True)
                if ready.returncode == 0:
                    break
                time.sleep(1)
            else:
                raise RuntimeError('Restore database failed to start')
            with backup.open('rb') as source:
                proc = subprocess.run(['docker', 'exec', '-i', clone, 'pg_restore', '-U', 'postgres', '-d', 'postgres',
                    '--no-owner', '--no-acl', '--exit-on-error', '--single-transaction'],
                    stdin=source, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE, timeout=600)
            if proc.returncode:
                raise RuntimeError('Restore failed: ' + label)
            sql = "SELECT schemaname, count(*) FROM pg_tables WHERE schemaname NOT IN ('pg_catalog','information_schema') GROUP BY schemaname ORDER BY schemaname"
            tables = run(['docker', 'exec', clone, 'psql', '-U', 'postgres', '-d', 'postgres', '-At', '-c', sql]).decode().strip()
            report['databases'][label] = {'bytes': backup.stat().st_size, 'sha256': digest(backup),
                'restoreVerified': True, 'tableCounts': tables, 'isolatedClone': clone}
            run(['docker', 'stop', '--time', '10', clone])
            active = None
        before = file_inventory(UPLOADS)
        archive = destination / 'uploads.tar.gz'
        with tarfile.open(archive, 'x:gz') as tar:
            for name in before:
                tar.add(UPLOADS / name, arcname=name, recursive=False)
        verify_archive(archive, before)
        if file_inventory(UPLOADS) != before:
            raise RuntimeError('Uploads changed during copy: repeat backup before cutover')
        (destination / 'files-manifest.json').write_text(json.dumps(before, indent=2), encoding='utf8')
        report['files'] = {'count': len(before), 'bytes': archive.stat().st_size, 'sha256': digest(archive), 'verified': True}
        report['state'] = 'backup-restored-not-ready-for-cutover'
    finally:
        if active:
            subprocess.run(['docker', 'stop', '--time', '10', active], capture_output=True, timeout=30)
        (destination / 'manifest.json').write_text(json.dumps(report, indent=2), encoding='utf8')
    print(json.dumps({'directory': str(destination), **report}))

if __name__ == '__main__':
    try:
        main()
    except Exception as error:
        print(json.dumps({'errorType': type(error).__name__, 'state': 'incomplete'}))
        raise SystemExit(1)
