"""Rehearse return to the legacy layout from a PRIVATE native stage, including new writes.

Never connects to original databases or activates a rollback. Stops only the verified
stage app briefly; keeps a full checkpoint/journal and restores two NEW offline DBs.
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
import tarfile
import time

spec = importlib.util.spec_from_file_location('consolidate', Path(__file__).with_name('directus-migration-consolidate.py'))
consolidate = importlib.util.module_from_spec(spec)
spec.loader.exec_module(consolidate)
backup = consolidate.backup
SCHEMAS = ['public', 'built_legacy', 'built_migration', 'asaas_sandbox', 'asaas_production', 'pinbank_dev', 'pinbank_production']
APP_SCHEMAS = ['public', 'asaas_sandbox', 'asaas_production', 'pinbank_dev', 'pinbank_production']


def validate_stage(root, manifest, app, db, network):
    if not re.fullmatch(r'/srv/built-migration/stage/runtime-[a-f0-9]+', str(root)) or root.is_symlink():
        raise ValueError('Invalid private stage directory')
    name = manifest.get('network', '')
    if not re.fullmatch(r'built-native-stage-[a-f0-9]{12}', name):
        raise ValueError('Unexpected stage identity')
    if manifest.get('productionCutover') is not False or manifest.get('externalIntegrations') is not False:
        raise ValueError('Not an isolated rehearsal')
    if not network.get('Internal') or network.get('Name') != name:
        raise ValueError('Stage network is not isolated')
    allowed = {name + '-app', name + '-db'}
    if any(item.get('Name') not in allowed for item in network.get('Containers', {}).values()):
        raise ValueError('Unexpected network participant')
    for info, suffix in [(app, '-app'), (db, '-db')]:
        if info.get('Name') != '/' + name + suffix or not info['State']['Running']:
            raise ValueError('Stage identity or state mismatch')
        bindings = info['HostConfig'].get('PortBindings') or {}
        private_binding = suffix == '-app' and set(bindings) == {'3018/tcp'} and bool(bindings['3018/tcp']) and all(p.get('HostIp') == '127.0.0.1' for p in bindings['3018/tcp'])
        if set(info['NetworkSettings']['Networks']) != {name} or (bindings and not private_binding):
            raise ValueError('Unexpected external exposure')
    env = dict(value.split('=', 1) for value in app['Config']['Env'] if '=' in value)
    if env.get('BUILT_ISOLATED_STAGE') != '1' or env.get('BUILT_DATA_BACKEND') != 'postgres':
        raise ValueError('Application is not a native private stage')
    if any(m['Type'] != 'volume' for m in db['Mounts']):
        raise ValueError('Database mount is not isolated')
    if manifest.get('application') != name + '-app' or manifest.get('database') != name + '-db':
        raise ValueError('Manifest identity mismatch')
    mount = [m for m in app['Mounts'] if m['Destination'] == '/app/native-uploads']
    if len(mount) != 1 or mount[0]['Source'] != str(root / 'uploads') or (root / 'uploads').is_symlink():
        raise ValueError('Unexpected asset storage')


def compatibility_toc(toc):
    # A fresh PostgreSQL database already owns public. Renaming built_legacy in
    # scratch makes pg_dump include CREATE SCHEMA public; reuse the empty target.
    # Only omit that declaration and our hooks; keep all business objects intact.
    return '\n'.join(line for line in toc.splitlines()
        if not re.search(r' TRIGGER \S+ \S+ built_migration_(capture|no_truncate) ', line)
        and not re.search(r' SCHEMA - public ', line)) + '\n'


def dump(container, database, destination, schemas=None):
    args = ['docker', 'exec', container, 'pg_dump', '-U', 'postgres', '-d', database, '--format=custom']
    for schema in schemas or []:
        args.append('--schema=' + schema)
    with destination.open('xb') as output:
        result = subprocess.run(args, stdout=output, stderr=subprocess.PIPE, timeout=600)
    if result.returncode:
        raise RuntimeError('Recovery export failed')


def restore_compatibility(container, database, source, root, label):
    remote = '/tmp/' + label + '.dump'
    backup.run(['docker', 'cp', str(source), container + ':' + remote])
    toc = backup.run(['docker', 'exec', container, 'pg_restore', '--list', remote]).decode()
    selected = root / (label + '.toc')
    selected.write_text(compatibility_toc(toc))
    backup.run(['docker', 'cp', str(selected), container + ':/tmp/' + label + '.toc'])
    backup.run(['docker', 'exec', container, 'pg_restore', '-U', 'postgres', '-d', database,
        '--no-owner', '--no-acl', '--exit-on-error', '--single-transaction',
        '--use-list=/tmp/' + label + '.toc', remote], timeout=600)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--rehearse-private-return', action='store_true')
    parser.add_argument('--stage-directory', required=True)
    args = parser.parse_args()
    if not args.rehearse_private_return or os.name != 'posix' or os.geteuid() != 0:
        raise ValueError('Explicit operator action required')
    os.umask(0o077)
    root = Path(args.stage_directory)
    manifest = json.loads((root / 'stage-manifest.json').read_text())
    inspect = lambda kind, name: json.loads(backup.run(['docker', kind, 'inspect', name]) if kind == 'network' else backup.run(['docker', 'inspect', name]))[0]
    app, db = manifest['application'], manifest['database']
    validate_stage(root, manifest, inspect('container', app), inspect('container', db), inspect('network', manifest['network']))
    if shutil.disk_usage(root).free < 4 * 1024**3:
        raise RuntimeError('Insufficient recovery capacity')
    destination = backup.fresh_directory(root, 'recovery-' + secrets.token_hex(8))
    clone = 'built-native-recovery-' + secrets.token_hex(8)
    report = {'state': 'incomplete', 'productionCutover': False, 'originalsChanged': False,
        'automaticRollback': False, 'retention': 'manual-only-no-expiry', 'container': clone}
    created = False
    try:
        # Quiesce only the private app; original services continue normally.
        backup.run(['docker', 'stop', '--time', '20', app])
        try:
            expected = consolidate.fingerprint(db, 'postgres', SCHEMAS)
            sequences = consolidate.sequence_state(db, 'postgres')
            dump(db, 'postgres', destination / 'native.dump')
            files = backup.file_inventory(root / 'uploads')
            with tarfile.open(destination / 'uploads.tar.gz', 'x:gz') as tar:
                for name in files:
                    tar.add(root / 'uploads' / name, arcname=name, recursive=False)
            backup.verify_archive(destination / 'uploads.tar.gz', files)
            if consolidate.fingerprint(db, 'postgres', SCHEMAS) != expected or consolidate.sequence_state(db, 'postgres') != sequences or backup.file_inventory(root / 'uploads') != files:
                raise RuntimeError('Concurrent write detected during recovery checkpoint')
        finally:
            backup.run(['docker', 'start', app])
        (destination / 'files-manifest.json').write_text(json.dumps(files, indent=2))
        backup.run(['docker', 'create', '--name', clone, '--network', 'none', '--restart', 'no',
            '--memory', '1g', '--cpus', '1', '-e', 'POSTGRES_HOST_AUTH_METHOD=trust', consolidate.IMAGE])
        created = True
        backup.run(['docker', 'start', clone])
        for _ in range(30):
            if subprocess.run(['docker', 'exec', clone, 'pg_isready', '-U', 'postgres'], capture_output=True).returncode == 0:
                break
            time.sleep(1)
        else:
            raise RuntimeError('Recovery clone not ready')
        for name in ['native_copy', 'legacy_layout', 'application_layout']:
            consolidate.sql(clone, 'postgres', 'CREATE DATABASE ' + name)
        consolidate.restore(clone, 'native_copy', destination / 'native.dump')
        if consolidate.fingerprint(clone, 'native_copy', SCHEMAS) != expected or consolidate.sequence_state(clone, 'native_copy') != sequences:
            raise RuntimeError('Full checkpoint mismatch')
        journal = int(consolidate.sql(clone, 'native_copy', 'SELECT count(*) FROM built_migration.changes'))
        dump(clone, 'native_copy', destination / 'application.dump', APP_SCHEMAS)
        # Rename in scratch only. This is a fresh restored DB, never the live stage.
        consolidate.sql(clone, 'native_copy', 'ALTER SCHEMA public RENAME TO built_runtime_hold; ALTER SCHEMA built_legacy RENAME TO public;')
        dump(clone, 'native_copy', destination / 'directus.dump', ['public'])
        restore_compatibility(clone, 'legacy_layout', destination / 'directus.dump', destination, 'legacy')
        restore_compatibility(clone, 'application_layout', destination / 'application.dump', destination, 'application')
        legacy_expected = {k.replace('built_legacy.', 'public.', 1): v for k, v in expected.items() if k.startswith('built_legacy.')}
        app_expected = {k: v for k, v in expected.items() if k.split('.')[0] in APP_SCHEMAS}
        if consolidate.fingerprint(clone, 'legacy_layout', ['public']) != legacy_expected or consolidate.fingerprint(clone, 'application_layout', APP_SCHEMAS) != app_expected:
            raise RuntimeError('Split layout content mismatch')
        for database, selected, rename in [('legacy_layout', ['built_legacy'], True), ('application_layout', APP_SCHEMAS, False)]:
            wanted = {(k.replace('built_legacy.', 'public.', 1) if rename else k): v for k, v in sequences.items() if k.split('.')[0] in selected}
            if consolidate.sequence_state(clone, database) != wanted:
                raise RuntimeError('Split layout sequence mismatch')
        report.update(state='private-return-restored-and-compared', tables=len(expected), files=len(files), journalEvents=journal,
            legacyTables=len(legacy_expected), applicationTables=len(app_expected),
            hashes={name: backup.digest(destination / name) for name in ['native.dump', 'application.dump', 'directus.dump', 'uploads.tar.gz']})
    finally:
        if created:
            subprocess.run(['docker', 'stop', '--time', '10', clone], capture_output=True, timeout=30)
        (destination / 'manifest.json').write_text(json.dumps(report, indent=2))
    print(json.dumps({'directory': str(destination), **report}))


if __name__ == '__main__':
    try:
        main()
    except Exception as error:
        print(json.dumps({'state': 'incomplete', 'errorType': type(error).__name__}))
        raise SystemExit(1)
