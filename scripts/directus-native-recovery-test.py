import copy
import importlib.util
from pathlib import Path
import unittest

spec = importlib.util.spec_from_file_location('recovery', Path(__file__).with_name('directus-native-recovery.py'))
recovery = importlib.util.module_from_spec(spec)
spec.loader.exec_module(recovery)


class RecoveryTests(unittest.TestCase):
    def test_only_private_stage_can_be_paused(self):
        root = Path('/srv/built-migration/stage/runtime-123abc')
        name = 'built-native-stage-123456abcdef'
        manifest = {'network': name, 'application': name + '-app', 'database': name + '-db', 'productionCutover': False, 'externalIntegrations': False}
        app = {'Name': '/' + name + '-app', 'State': {'Running': True}, 'NetworkSettings': {'Networks': {name: {}}},
            'HostConfig': {'PortBindings': {}}, 'Config': {'Env': ['BUILT_ISOLATED_STAGE=1', 'BUILT_DATA_BACKEND=postgres']},
            'Mounts': [{'Type': 'bind', 'Source': str(root / 'uploads'), 'Destination': '/app/native-uploads'}]}
        db = copy.deepcopy(app)
        db.update(Name='/' + name + '-db', Mounts=[{'Type': 'volume'}])
        network = {'Name': name, 'Internal': True, 'Containers': {'a': {'Name': name + '-app'}, 'b': {'Name': name + '-db'}}}
        recovery.validate_stage(root, manifest, app, db, network)
        private_app = copy.deepcopy(app)
        private_app['HostConfig']['PortBindings'] = {'3018/tcp': [{'HostIp': '127.0.0.1', 'HostPort': '3018'}]}
        recovery.validate_stage(root, manifest, private_app, db, network)
        for field, changed in [('Name', '/production'), ('State', {'Running': False}), ('NetworkSettings', {'Networks': {'bridge': {}}}), ('HostConfig', {'PortBindings': {'3018/tcp': [{}]}}), ('Config', {'Env': []}), ('Mounts', [])]:
            altered = copy.deepcopy(app)
            altered[field] = changed
            with self.assertRaises(ValueError): recovery.validate_stage(root, manifest, altered, db, network)
        for altered in [dict(network, Internal=False), dict(network, Containers={'x': {'Name': 'production'}})]:
            with self.assertRaises(ValueError): recovery.validate_stage(root, manifest, app, db, altered)
        with self.assertRaises(ValueError): recovery.validate_stage(root, dict(manifest, productionCutover=True), app, db, network)
        with self.assertRaises(ValueError): recovery.validate_stage(Path('/srv/captain'), manifest, app, db, network)

    def test_compatibility_removes_only_private_journal_hooks(self):
        toc = '\n'.join(['; header', '10; 2620 123 TRIGGER public fluxo_caixa built_migration_capture postgres',
            '9; 2615 2200 SCHEMA - public postgres',
            '11; 2620 124 TRIGGER public fluxo_caixa built_migration_no_truncate postgres',
            '12; 2620 125 TRIGGER public fluxo_caixa business_audit postgres',
            '13; 1259 126 TABLE public built_migration_capture postgres',
            '14; 0 126 TABLE DATA public fluxo_caixa postgres'])
        result = recovery.compatibility_toc(toc)
        self.assertNotIn('10;', result)
        self.assertNotIn('11;', result)
        self.assertNotIn('9;', result)
        for kept in ['12;', '13;', '14;']: self.assertIn(kept, result)


if __name__ == '__main__': unittest.main()
