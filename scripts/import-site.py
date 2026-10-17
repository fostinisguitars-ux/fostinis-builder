"""Import the owner's verified website snapshot and its public visual assets."""
from pathlib import Path,PurePosixPath
from concurrent.futures import ThreadPoolExecutor,as_completed
import hashlib,io,json,os,tarfile,time,urllib.parse,urllib.request

ORIGIN='https://fostinis-design-review.bouncybow11.chatgpt.site'
URL=ORIGIN+'/github-export/fostinis-source-20261017.tar.xz'
EXPECTED=os.environ['SOURCE_ARCHIVE_SHA256']
root=Path.cwd().resolve()

def download(url):
    for attempt in range(4):
        try:
            req=urllib.request.Request(url,headers={'User-Agent':'Fostinis-Guitars-Source-Import','Accept-Encoding':'identity'})
            with urllib.request.urlopen(req,timeout=60) as response:return response.read()
        except Exception:
            if attempt==3:raise
            time.sleep(1+attempt)

def safe_path(name):
    p=PurePosixPath(name)
    if p.is_absolute() or '..' in p.parts or '.git' in p.parts or not p.parts:raise ValueError('Unsafe archive path')
    dest=(root/name).resolve()
    if not dest.is_relative_to(root):raise ValueError('Path leaves repository')
    return dest

archive=download(URL+'?sha256='+EXPECTED)
if hashlib.sha256(archive).hexdigest()!=EXPECTED:raise ValueError('Source archive hash does not match the approved snapshot')
with tarfile.open(fileobj=io.BytesIO(archive),mode='r:xz') as tar:
    members=tar.getmembers()
    for member in members:
        if not member.isfile():raise ValueError('Only regular files are allowed')
        safe_path(member.name)
    for member in members:
        dest=safe_path(member.name);dest.parent.mkdir(parents=True,exist_ok=True)
        dest.write_bytes(tar.extractfile(member).read());dest.chmod(member.mode&0o755)

manifest=json.loads((root/'site-transfer-manifest.json').read_text())
if manifest['source_origin']!=ORIGIN:raise ValueError('Unexpected asset origin')
for entry in manifest['source_files']:
    data=safe_path(entry['path']).read_bytes()
    if len(data)!=entry['size'] or hashlib.sha256(data).hexdigest()!=entry['sha256']:raise ValueError('Source file integrity failure: '+entry['path'])

def asset(entry):
    if not entry['path'].startswith('public/') or entry['url_path']!='/'+entry['path'][7:]:raise ValueError('Unexpected asset path')
    dest=safe_path(entry['path'])
    if dest.exists() and hashlib.sha256(dest.read_bytes()).hexdigest()==entry['sha256']:return
    url=ORIGIN+urllib.parse.quote(entry['url_path'],safe='/')+'?snapshot='+entry['sha256']
    data=download(url)
    if len(data)!=entry['size'] or hashlib.sha256(data).hexdigest()!=entry['sha256']:raise ValueError('Asset integrity failure: '+entry['path'])
    dest.parent.mkdir(parents=True,exist_ok=True);dest.write_bytes(data)

with ThreadPoolExecutor(max_workers=12) as pool:
    futures=[pool.submit(asset,a) for a in manifest['assets']]
    for count,future in enumerate(as_completed(futures),1):
        future.result()
        if count%200==0 or count==len(futures):print(f'Verified {count}/{len(futures)} visual assets',flush=True)

print(f"Verified {len(manifest['source_files'])} source files and {len(manifest['assets'])} visual assets.")
