import copy
import importlib.util
import json
from pathlib import Path
import tarfile
import tempfile
import unittest

spec = importlib.util.spec_from_file_location('checkpoint', Path(__file__).with_name('directus-migration-checkpoint.py'))
checkpoint = importlib.util.module_from_spec(spec)
spec.loader.exec_module(checkpoint)
consolidate = checkpoint.consolidate
backup = consolidate.backup


class ConsolidateTests(unittest.TestCase):
    def test_clone_identity_and_isolation(self):
        info = {'Name': '/built-migration-consolidated-test-run',
            'Config': {'Image': consolidate.IMAGE, 'Labels': {'built.migration.run': 'test-run'}},
            'HostConfig': {'NetworkMode': 'none', 'PortBindings': {}},
            'State': {'Running': False}, 'Mounts': [{'Type': 'volume'}]}
        self.assertEqual(checkpoint.validate_clone(info, 'test-run'), info['Name'][1:])
        for key, value in [('NetworkMode', 'bridge'), ('PortBindings', {'5432/tcp': []})]:
            altered = copy.deepcopy(info)
            altered['HostConfig'][key] = value
            with self.assertRaises(ValueError): checkpoint.validate_clone(altered, 'test-run')
        for altered in [dict(info, Name='/production'), dict(info, State={'Running': True}),
                        dict(info, Mounts=[{'Type': 'bind'}]), dict(info, Config={'Image': 'other'})]:
            with self.assertRaises(ValueError): checkpoint.validate_clone(altered, 'test-run')

    def test_backup_integrity_before_creating_destination(self):
        previous = backup.ROOT
        with tempfile.TemporaryDirectory() as temporary:
            backup.ROOT = Path(temporary)
            try:
                directory = backup.fresh_directory(backup.ROOT, 'fixture')
                records = {}
                for name in ('directus', 'application'):
                    path = directory / (name + '.dump')
                    path.write_bytes(b'fixture-dump')
                    records[name] = {'restoreVerified': True, 'sha256': backup.digest(path)}
                with tarfile.open(directory / 'uploads.tar.gz', 'w:gz'): pass
                (directory / 'files-manifest.json').write_text('{}')
                manifest = {'state': 'backup-restored-not-ready-for-cutover', 'databases': records,
                    'files': {'sha256': backup.digest(directory / 'uploads.tar.gz'), 'count': 0}}
                (directory / 'manifest.json').write_text(json.dumps(manifest))
                self.assertEqual(consolidate.verified_backup('fixture')[0], directory)
                (directory / 'application.dump').write_bytes(b'changed')
                with self.assertRaisesRegex(ValueError, 'checksum'): consolidate.verified_backup('fixture')
                with self.assertRaises(ValueError): consolidate.verified_backup('../fixture')
            finally:
                backup.ROOT = previous


if __name__ == '__main__': unittest.main()
