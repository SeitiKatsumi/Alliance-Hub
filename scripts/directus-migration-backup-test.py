"""Run with Python3 on the operator host, without touching Docker or production."""
import importlib.util
import io
from pathlib import Path
import tarfile
import tempfile
import unittest

spec = importlib.util.spec_from_file_location('backup', Path(__file__).with_name('directus-migration-backup.py'))
backup = importlib.util.module_from_spec(spec)
spec.loader.exec_module(backup)

class BackupTests(unittest.TestCase):
    def test_no_overwrite_or_path_escape(self):
        with tempfile.TemporaryDirectory() as d:
            root = Path(d)
            backup.fresh_directory(root, 'test-1')
            with self.assertRaises(FileExistsError): backup.fresh_directory(root, 'test-1')
            with self.assertRaises(ValueError): backup.fresh_directory(root, '../escape')

    def test_hash_and_archive_integrity(self):
        with tempfile.TemporaryDirectory() as d:
            root = Path(d) / 'source'; root.mkdir()
            (root / 'file').write_bytes(b'preserved')
            expected = backup.file_inventory(root)
            archive = Path(d) / 'files.tar.gz'
            with tarfile.open(archive, 'w:gz') as tar: tar.add(root / 'file', arcname='file')
            backup.verify_archive(archive, expected)
            expected['file']['sha256'] = 'wrong'
            with self.assertRaises(RuntimeError): backup.verify_archive(archive, expected)

    def test_symlink_refused(self):
        with tempfile.TemporaryDirectory() as d:
            root=Path(d); (root/'link').symlink_to('/etc/passwd')
            with self.assertRaises(RuntimeError): backup.file_inventory(root)

    def test_archive_path_escape_refused_without_extraction(self):
        with tempfile.TemporaryDirectory() as d:
            archive=Path(d)/'bad.tar.gz'
            with tarfile.open(archive,'w:gz') as tar:
                item=tarfile.TarInfo('../escape'); item.size=1; tar.addfile(item,io.BytesIO(b'x'))
            with self.assertRaises(RuntimeError): backup.verify_archive(archive,{})

if __name__ == '__main__': unittest.main()
