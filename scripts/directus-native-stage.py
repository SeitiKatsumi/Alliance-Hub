"""Operator-only private runtime rehearsal. Copies a verified checkpoint; no source writes.
Run in a fresh uploaded build directory containing dist, package files and schema SQL.
"""
import argparse
import json
import os
from pathlib import Path
import secrets
import shutil
import socket
import subprocess
import time


def run(args, **kwargs):
    result = subprocess.run(args, capture_output=True, timeout=kwargs.pop('timeout', 120), **kwargs)
    if result.returncode:
        raise RuntimeError('Stage operation failed: ' + args[0])
    return result.stdout


def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('--prepare-and-start', action='store_true')
    parser.add_argument('--checkpoint', required=True)
    args=parser.parse_args()
    if not args.prepare_and_start or os.geteuid()!=0: raise ValueError('Explicit operator action required')
    os.umask(0o077)
    root=Path(__file__).resolve().parent.parent
    if not str(root).startswith('/srv/built-migration/stage/runtime-') or root.is_symlink(): raise ValueError('Unexpected workspace')
    if (root/'stage-manifest.json').exists(): raise ValueError('Do not overwrite a staging run')
    if shutil.disk_usage(root).free < 5*1024**3: raise RuntimeError('Insufficient staging capacity')
    with socket.socket() as s:
        if s.connect_ex(('127.0.0.1',3018))==0: raise RuntimeError('Private staging port already used')
    checkpoint=Path(args.checkpoint)
    import re
    if not re.fullmatch(r'/srv/built-migration/consolidated/[a-z0-9-]+/checkpoint-[a-f0-9]+',str(checkpoint)) or checkpoint.is_symlink() or checkpoint.resolve()!=checkpoint:
        raise ValueError('Unexpected checkpoint path')
    manifest=json.loads((checkpoint/'manifest.json').read_text())
    if manifest['state']!='checkpoint-restored-offline': raise ValueError('Checkpoint not verified')
    import hashlib
    def digest(p):
        h=hashlib.sha256()
        with p.open('rb') as f:
            for b in iter(lambda:f.read(1048576),b''): h.update(b)
        return h.hexdigest()
    if digest(checkpoint/'consolidated.dump')!=manifest['databaseSha256']: raise ValueError('Checkpoint mismatch')
    if digest(checkpoint/'uploads.tar.gz')!=manifest['archiveSha256']: raise ValueError('Files mismatch')
    uploads=root/'uploads'
    uploads.mkdir(mode=0o700)
    import tarfile
    with tarfile.open(checkpoint/'uploads.tar.gz','r:gz') as tar:
        for member in tar:
            relative=Path(member.name)
            if not member.isfile() or relative.is_absolute() or '..' in relative.parts: raise ValueError('Unsafe path')
            target=uploads/relative
            target.parent.mkdir(mode=0o700,parents=True,exist_ok=True)
            with target.open('xb') as output,tar.extractfile(member) as source: shutil.copyfileobj(source,output)
    expected=json.loads((checkpoint/'files-manifest.json').read_text())
    if any(digest(uploads/name)!=info['sha256'] for name,info in expected.items()): raise ValueError('Extracted files mismatch')
    build=root/'Dockerfile.native'
    build.write_text('FROM img-captain-built-hub-app:229\nWORKDIR /app\nCOPY package.json package-lock.json ./\nRUN npm ci --omit=dev\nCOPY dist ./dist\nENTRYPOINT ["node","dist/index.cjs"]\n')
    suffix=secrets.token_hex(6)
    image='built-native-stage:'+suffix
    with (root/'image-build.log').open('xb') as log:
        result=subprocess.run(['docker','build','-f',str(build),'-t',image,str(root)],stdout=log,stderr=subprocess.STDOUT,timeout=900)
    if result.returncode: raise RuntimeError('Stage image build failed')
    network='built-native-stage-'+suffix
    database=network+'-db'
    application=network+'-app'
    report={'state':'incomplete','network':network,'database':database,'application':application,'image':image,
        'productionCutover':False,'retention':'manual-only-no-expiry','externalIntegrations':False}
    try:
        run(['docker','network','create','--internal',network])
        run(['docker','run','-d','--name',database,'--network',network,'--restart','no','--memory','1g','--cpus','1',
             '-e','POSTGRES_HOST_AUTH_METHOD=trust','postgres:17-alpine'])
        for _ in range(30):
            if subprocess.run(['docker','exec',database,'pg_isready','-U','postgres'],capture_output=True).returncode==0: break
            time.sleep(1)
        with (checkpoint/'consolidated.dump').open('rb') as source:
            result=subprocess.run(['docker','exec','-i',database,'pg_restore','-U','postgres','-d','postgres','--no-owner','--no-acl','--exit-on-error','--single-transaction'],stdin=source,stdout=subprocess.DEVNULL,stderr=subprocess.PIPE,timeout=600)
        if result.returncode: raise RuntimeError('Stage database restore failed')
        run(['docker','exec','-i',database,'psql','-X','-v','ON_ERROR_STOP=1','-U','postgres','-d','postgres'],input=(root/'scripts/directus-native-schema.sql').read_bytes())
        env=root/'stage.env'
        env.write_text('\n'.join([
            'BUILT_DATA_BACKEND=postgres','BUILT_ISOLATED_STAGE=1','DATABASE_URL=postgres://postgres@'+database+':5432/postgres',
            'DIRECTUS_URL=http://native-data.invalid','BUILT_ASSETS_ROOT=/app/native-uploads',
            'SESSION_SECRET='+secrets.token_hex(48),'PORT=3018','APP_URL=http://127.0.0.1:3018',
            'ASAAS_CONTRIBUTIONS_ENABLED=false','ASAAS_TRANSFERS_ENABLED=false','ASAAS_PRODUCTION_ENABLED=false',
        ])+'\n')
        run(['docker','run','-d','--name',application,'--network',network,'--restart','no','--memory','2g','--cpus','1',
            '--env-file',str(env),'--mount','type=bind,source='+str(uploads)+',target=/app/native-uploads',image])
        # Internal networks intentionally have no published ports. Access via an
        # operator SSH tunnel to this private IP, bound to localhost at the client.
        info=json.loads(run(['docker','inspect',application]))[0]
        report['privateAddress']=info['NetworkSettings']['Networks'][network]['IPAddress']+':3018'
        report['state']='private-runtime-awaiting-validation'
    finally:
        (root/'stage-manifest.json').write_text(json.dumps(report,indent=2))
        if report['state']=='incomplete':
            # Stop only this run; never remove copies or original services.
            subprocess.run(['docker','stop',application,database],capture_output=True,timeout=40)
    print(json.dumps({'directory':str(root),**report}))


if __name__=='__main__':
    try: main()
    except Exception as error:
        print(json.dumps({'state':'incomplete','errorType':type(error).__name__}))
        raise SystemExit(1)
