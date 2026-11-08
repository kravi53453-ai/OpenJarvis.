import json,hashlib,urllib.request
from pathlib import Path
def stage(url,root):
 with urllib.request.urlopen(url,timeout=20) as r:m=json.loads(r.read(500000))
 base=Path(root).resolve(); dest=base/"updates/staged"; dest.mkdir(parents=True,exist_ok=True); done=[]
 for f in m.get("files",[]):
  rel=Path(f["path"])
  if rel.is_absolute() or ".." in rel.parts or not f["url"].startswith("https://"):raise ValueError("unsafe update manifest")
  with urllib.request.urlopen(f["url"],timeout=30) as r:data=r.read(5000000)
  digest=hashlib.sha256(data).hexdigest()
  if digest.lower()!=f["sha256"].lower():raise ValueError("hash mismatch")
  p=(dest/rel).resolve()
  if dest.resolve() not in p.parents:raise ValueError("path escape")
  p.parent.mkdir(parents=True,exist_ok=True);p.write_bytes(data);done.append(str(rel))
 (dest/"manifest.json").write_text(json.dumps(m,indent=2))
 return {"staged":done,"version":m.get("version"),"note":"Hash checks detect corruption, not publisher identity. Authenticate a signed release before manual application and restart."}
