import os,platform,shutil,subprocess
def cmd(a):
 try:
  p=subprocess.run(a,capture_output=True,text=True,timeout=3); return p.stdout.strip() if p.returncode==0 else None
 except (OSError,subprocess.TimeoutExpired):return None
def info():
 mem={}
 try:
  for line in open("/proc/meminfo"):
   k,_,v=line.partition(":")
   if k in ("MemTotal","MemAvailable"):mem[k]=v.strip()
 except OSError:pass
 d=shutil.disk_usage(os.path.expanduser("~"))
 return {"manufacturer":cmd(["getprop","ro.product.manufacturer"]),"model":cmd(["getprop","ro.product.model"]),"android":cmd(["getprop","ro.build.version.release"]),"cpu":platform.machine(),"memory":mem,"storage_total":d.total,"storage_free":d.free,"battery":cmd(["termux-battery-status"]),"python":platform.python_version()}
