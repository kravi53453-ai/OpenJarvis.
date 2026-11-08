import re,time
OPS={"spawn","move","dialogue","trigger","light","checkpoint","teleport","score"}
def build(x):
 title=str(x.get("title","Craftland Blueprint"))[:100]; slug=re.sub(r"[^a-z0-9_-]+","-",title.lower()).strip("-") or "blueprint"
 blocks=x.get("blocks",[])
 if not isinstance(blocks,list) or len(blocks)>200:raise ValueError("blocks must be a list up to 200")
 out=[]
 for i,b in enumerate(blocks):
  op=str(b.get("op","")).lower()
  if op not in OPS:raise ValueError("unsupported operation: "+op)
  out.append({"id":str(b.get("id",i+1)),"op":op,"name":str(b.get("name",op))[:100],"params":b.get("params",{}) if isinstance(b.get("params",{}),dict) else {}})
 return {"title":title,"slug":slug[:60],"schema_version":1,"created":time.time(),"blocks":out,"valid":True,"note":"Independent planning data; actual import depends on supported Craftland formats."}
