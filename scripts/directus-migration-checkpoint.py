"""Verified restore point for an OFFLINE consolidated clone. Not a live cutover tool.

Preserves all rows including the change journal. Never rewrites original Directus.
"""
import argparse
import importlib.util
import json
import os
from pathlib import Path
import re
import secrets
import shutil
import subprocess
import time

spec = importlib.util.spec_from_file_location('consolidate', Path(__file__).with_name('directus-migration-consolidate.py'))
consolidate = importlib.util.module_from_spec(spec)
spec.loader.exec_module(consolidate)
backup = consolidate.backup


def validate_clone(info, run_id):
    expected = 'built-migration-consolidated-' + run_id
    if (info['Name'] != '/' + expected or info['Config']['Image'] != consolidate.IMAGE
        or info['Config'].get('Labels', {}).get('built.migration.run') != run_id
        or info['HostConfig']['NetworkMode'] != 'none'
        or info['HostConfig'].get('PortBindings')
        or info['State']['Running']
        or any(m['Type'] != 'volume' for m in info['Mounts'])):
        raise ValueError('Not an offline isolated migration clone')
    return expected


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--checkpoint-and-rehearse', action='store_true')
    parser.add_argument('--consolidated-run', required=True)
    args = parser.parse_args()
    if not args.checkpoint_and_rehearse:
        parser.error('Explicit --checkpoint-and-rehearse required')
    if os.name != 'posix' or os.geteuid() != 0 or not re.fullmatch(r'[a-z0-9-]+', args.consolidated_run):
        raise ValueError('Invalid operator or run')
    os.umask(0o077)
    root = consolidate.ROOT / args.consolidated_run
    if root.is_symlink() or not root.is_dir():
        raise ValueError('Invalid consolidated directory')
    manifest = json.loads((root / 'manifest.json').read_text())
    if manifest.get('state') != 'consolidated-offline-runtime-pending':
        raise ValueError('Consolidation not verified')
    name = 'built-migration-consolidated-' + args.consolidated_run
    info = json.loads(backup.run(['docker', 'inspect', name]))[0]
    clone = validate_clone(info, args.consolidated_run)
    if manifest.get('container') != clone:
        raise ValueError('Clone identity mismatch')
    if shutil.disk_usage(root).free < 3 * 1024**3:
        raise RuntimeError('Insufficient space for recovery rehearsal')
    destination = backup.fresh_directory(root, 'checkpoint-' + secrets.token_hex(8))
    report = {'state': 'incomplete', 'container': clone, 'productionCutover': False,
        'retention': 'manual-only-no-expiry', 'automaticRollback': False}
    try:
        backup.run(['docker', 'start', clone])
        for attempt in range(30):
            ready = subprocess.run(['docker', 'exec', clone, 'pg_isready', '-U', 'postgres'], capture_output=True)
            if ready.returncode == 0:
                break
            time.sleep(1)
        else:
            raise RuntimeError('Clone not ready')
        schemas = ['public', 'built_legacy', 'built_migration', 'asaas_sandbox', 'asaas_production', 'pinbank_dev', 'pinbank_production']
        expected = consolidate.fingerprint(clone, 'built_stage', schemas)
        sequences = consolidate.sequence_state(clone, 'built_stage')
        dump = destination / 'consolidated.dump'
        with dump.open('xb') as output:
            proc = subprocess.run(['docker', 'exec', '-e', 'PGOPTIONS=-c default_transaction_read_only=on', clone,
                'pg_dump', '-U', 'postgres', '-d', 'built_stage', '--format=custom'],
                stdout=output, stderr=subprocess.PIPE, timeout=600)
        if proc.returncode:
            raise RuntimeError('Checkpoint failed')
        recovery = 'recovery_' + secrets.token_hex(8)
        consolidate.sql(clone, 'postgres', 'CREATE DATABASE ' + consolidate.quote(recovery))
        consolidate.restore(clone, recovery, dump)
        if consolidate.fingerprint(clone, recovery, schemas) != expected:
            raise RuntimeError('Recovery mismatch')
        if consolidate.fingerprint(clone, 'built_stage', schemas) != expected:
            raise RuntimeError('Unexpected concurrent write')
        if (consolidate.sequence_state(clone, recovery) != sequences
            or consolidate.sequence_state(clone, 'built_stage') != sequences):
            raise RuntimeError('Recovery sequence mismatch')
        journal = int(consolidate.sql(clone, recovery, 'SELECT count(*) FROM built_migration.changes'))
        source_files = backup.file_inventory(root / 'uploads')
        # Own full file archive: checkpoint remains usable if staging files later change.
        import tarfile
        archive = destination / 'uploads.tar.gz'
        with tarfile.open(archive, 'x:gz') as tar:
            for name in source_files:
                tar.add(root / 'uploads' / name, arcname=name, recursive=False)
        backup.verify_archive(archive, source_files)
        if backup.file_inventory(root / 'uploads') != source_files:
            raise RuntimeError('Files changed during checkpoint')
        (destination / 'files-manifest.json').write_text(json.dumps(source_files, indent=2))
        report.update(state='checkpoint-restored-offline', databaseSha256=backup.digest(dump),
            archiveSha256=backup.digest(archive), files=len(source_files), tables=len(expected),
            journalEvents=journal, recoveryDatabase=recovery)
    finally:
        subprocess.run(['docker', 'stop', '--time', '10', clone], capture_output=True, timeout=30)
        (destination / 'manifest.json').write_text(json.dumps(report, indent=2))
    print(json.dumps({'directory': str(destination), **report}))


if __name__ == '__main__':
    try:
        main()
    except Exception as error:
        print(json.dumps({'errorType': type(error).__name__, 'state': 'incomplete'}))
        raise SystemExit(1)
