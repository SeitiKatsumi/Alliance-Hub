"""Consolidate verified dumps into a NEW offline database. Never uses source DBs.

Only pg17 isolated clones; no app, ports, network, sends, cutover or deletion.
Run on Docker host with backup.py and journal.sql next to this file.
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

spec = importlib.util.spec_from_file_location('backup', Path(__file__).with_name('directus-migration-backup.py'))
backup = importlib.util.module_from_spec(spec)
spec.loader.exec_module(backup)
ROOT = Path('/srv/built-migration/consolidated')
IMAGE = 'postgres:17-alpine'


def verified_backup(run_id):
    if not re.fullmatch(r'[a-z0-9-]+', run_id):
        raise ValueError('Invalid backup ID')
    directory = backup.ROOT / run_id
    if directory.is_symlink() or not directory.is_dir():
        raise ValueError('Invalid backup directory')
    manifest = json.loads((directory / 'manifest.json').read_text())
    if manifest.get('state') != 'backup-restored-not-ready-for-cutover':
        raise ValueError('Backup not verified')
    for name in ('directus', 'application'):
        entry = manifest['databases'][name]
        path = directory / (name + '.dump')
        if path.is_symlink() or not entry['restoreVerified'] or backup.digest(path) != entry['sha256']:
            raise ValueError('Database checksum mismatch')
    archive = directory / 'uploads.tar.gz'
    if archive.is_symlink() or backup.digest(archive) != manifest['files']['sha256']:
        raise ValueError('Uploads checksum mismatch')
    inventory = json.loads((directory / 'files-manifest.json').read_text())
    if len(inventory) != manifest['files']['count']:
        raise ValueError('Uploads count mismatch')
    backup.verify_archive(archive, inventory)
    return directory, manifest


def sql(container, database, statement):
    return backup.run(['docker', 'exec', '-i', container, 'psql', '-X', '-v', 'ON_ERROR_STOP=1',
        '-U', 'postgres', '-d', database, '-At'], input=statement.encode(), timeout=600).decode().strip()


def restore(container, database, path):
    with path.open('rb') as source:
        result = subprocess.run(['docker', 'exec', '-i', container, 'pg_restore', '-U', 'postgres',
            '-d', database, '--no-owner', '--no-acl', '--exit-on-error', '--single-transaction'],
            stdin=source, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE, timeout=600)
    if result.returncode:
        raise RuntimeError('Restore failed')


def quote(identifier):
    return '"' + identifier.replace('"', '""') + '"'


def fingerprint(container, database, schemas):
    # Only fixed, operator-owned schema names; no user input is interpolated.
    if not set(schemas) <= {'public', 'built_legacy', 'built_migration', 'asaas_sandbox', 'asaas_production', 'pinbank_dev', 'pinbank_production'}:
        raise ValueError('Unexpected schema')
    names = ','.join("'" + s + "'" for s in schemas)
    tables = json.loads(sql(container, database,
        "SELECT coalesce(json_agg(json_build_array(schemaname,tablename) ORDER BY schemaname,tablename),'[]') FROM pg_tables WHERE schemaname IN (" + names + ')'))
    result = {}
    for schema, table in tables:
        value = sql(container, database, "SET timezone='UTC'; SELECT json_build_object('rows',count(*),'hash',md5(coalesce(string_agg(h,'' ORDER BY h),''))) FROM (SELECT md5(to_jsonb(t)::text) h FROM " + quote(schema) + '.' + quote(table) + ' t) s')
        result[schema + '.' + table] = json.loads(value.splitlines()[-1])
    return result


def sequence_state(container, database):
    sequences = json.loads(sql(container, database,
        "SELECT coalesce(json_agg(json_build_array(schemaname,sequencename) ORDER BY schemaname,sequencename),'[]') FROM pg_sequences WHERE schemaname NOT IN ('pg_catalog','information_schema')"))
    return {schema + '.' + name: json.loads(sql(container, database,
        "SELECT json_build_object('value',last_value::text,'called',is_called) FROM " + quote(schema) + '.' + quote(name)))
        for schema, name in sequences}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--consolidate-offline', action='store_true')
    parser.add_argument('--backup-run', required=True)
    args = parser.parse_args()
    if not args.consolidate_offline:
        parser.error('Explicit --consolidate-offline required')
    if os.name != 'posix' or os.geteuid() != 0:
        raise RuntimeError('Run as operator on Docker host')
    os.umask(0o077)
    source, manifest = verified_backup(args.backup_run)
    ROOT.mkdir(mode=0o700, parents=True, exist_ok=True)
    if ROOT.is_symlink() or shutil.disk_usage(ROOT).free < 3 * 1024**3:
        raise RuntimeError('Unsafe destination or insufficient space')
    os.chmod(ROOT, 0o700)
    backup.run(['docker', 'image', 'inspect', IMAGE])
    run_id = time.strftime('%Y%m%dT%H%M%S', time.gmtime()).lower() + '-' + secrets.token_hex(4)
    destination = backup.fresh_directory(ROOT, run_id)
    clone = 'built-migration-consolidated-' + run_id
    report = {'state': 'incomplete', 'sourceBackup': args.backup_run, 'container': clone,
              'productionCutover': False, 'retention': 'manual-only-no-expiry'}
    created = False
    try:
        backup.run(['docker', 'create', '--name', clone, '--network', 'none', '--restart', 'no',
            '--label', 'built.migration.run=' + run_id, '--memory', '1g', '--cpus', '1',
            '-e', 'POSTGRES_HOST_AUTH_METHOD=trust', IMAGE])
        created = True
        backup.run(['docker', 'start', clone])
        for attempt in range(30):
            ready = subprocess.run(['docker', 'exec', clone, 'pg_isready', '-U', 'postgres'], capture_output=True)
            if ready.returncode == 0:
                break
            time.sleep(1)
        else:
            raise RuntimeError('Clone not ready')
        sql(clone, 'postgres', 'CREATE DATABASE built_stage;')
        sql(clone, 'postgres', 'CREATE DATABASE legacy_scratch;')
        restore(clone, 'built_stage', source / 'application.dump')
        restore(clone, 'legacy_scratch', source / 'directus.dump')
        schemas = ['public', 'asaas_sandbox', 'asaas_production', 'pinbank_dev', 'pinbank_production']
        application = fingerprint(clone, 'built_stage', schemas)
        legacy = fingerprint(clone, 'legacy_scratch', ['public'])
        sequences = {**sequence_state(clone, 'built_stage'), **{
            k.replace('public.', 'built_legacy.', 1): v
            for k, v in sequence_state(clone, 'legacy_scratch').items()}}
        # Rename only the scratch copy. PostgreSQL follows schema-qualified dependencies.
        sql(clone, 'legacy_scratch', 'ALTER SCHEMA public RENAME TO built_legacy;')
        relocated = destination / 'legacy-schema.dump'
        with relocated.open('xb') as output:
            proc = subprocess.run(['docker', 'exec', clone, 'pg_dump', '-U', 'postgres', '-d',
                'legacy_scratch', '--schema=built_legacy', '--format=custom'],
                stdout=output, stderr=subprocess.PIPE, timeout=600)
        if proc.returncode:
            raise RuntimeError('Relocated dump failed')
        restore(clone, 'built_stage', relocated)
        expected = {**application, **{k.replace('public.', 'built_legacy.', 1): v for k, v in legacy.items()}}
        actual = fingerprint(clone, 'built_stage', schemas + ['built_legacy'])
        if actual != expected:
            raise RuntimeError('Consolidated row fingerprint mismatch')
        if sequence_state(clone, 'built_stage') != sequences:
            raise RuntimeError('Consolidated sequence mismatch')
        sql(clone, 'built_stage', Path(__file__).with_name('directus-migration-journal.sql').read_text())
        trigger_count = int(sql(clone, 'built_stage', "SELECT count(*) FROM pg_trigger WHERE tgname='built_migration_capture'"))
        if trigger_count != len(expected):
            raise RuntimeError('Incomplete change journal')
        # Keep file bytes in a separate private persistent directory, never in app image.
        uploads = destination / 'uploads'
        uploads.mkdir(mode=0o700)
        import tarfile
        with tarfile.open(source / 'uploads.tar.gz', 'r:gz') as tar:
            for member in tar:
                relative = Path(member.name)
                if not member.isfile() or relative.is_absolute() or '..' in relative.parts:
                    raise RuntimeError('Unsafe upload path')
                path = uploads / relative
                path.parent.mkdir(mode=0o700, parents=True, exist_ok=True)
                with path.open('xb') as output, tar.extractfile(member) as stream:
                    shutil.copyfileobj(stream, output)
        if backup.file_inventory(uploads) != json.loads((source / 'files-manifest.json').read_text()):
            raise RuntimeError('Extracted files mismatch')
        (destination / 'table-fingerprints.json').write_text(json.dumps(actual, indent=2))
        (destination / 'sequence-state.json').write_text(json.dumps(sequences, indent=2))
        report.update(state='consolidated-offline-runtime-pending', tables=len(actual),
            rows=sum(v['rows'] for v in actual.values()), files=manifest['files']['count'],
            journalTables=trigger_count, fingerprintsVerified=True)
    finally:
        if created:
            subprocess.run(['docker', 'stop', '--time', '10', clone], capture_output=True, timeout=30)
        (destination / 'manifest.json').write_text(json.dumps(report, indent=2))
    print(json.dumps({'directory': str(destination), **report}))


if __name__ == '__main__':
    try:
        main()
    except Exception as error:
        print(json.dumps({'errorType': type(error).__name__, 'state': 'incomplete'}))
        raise SystemExit(1)
