import os,json,urllib.request,urllib.error
class Chat:
 def __init__(self,state):self.s=state
 def reply(self,m):
  m=m.strip()
  if not m:return "कृपया अपना सवाल लिखें।"
  self.s.add("user",m); a=self.remote(m) or self.local(m); self.s.add("assistant",a); return a
 def remote(self,m):
  u=os.getenv("OPENJARVIS_CHAT_ENDPOINT",""); k=os.getenv("OPENJARVIS_CHAT_KEY","")
  if not u:return None
  body=json.dumps({"model":os.getenv("OPENJARVIS_CHAT_MODEL","default"),"messages":[{"role":"user","content":m}]}).encode()
  req=urllib.request.Request(u,data=body,headers={"Content-Type":"application/json",**({"Authorization":"Bearer "+k} if k else {})})
  try:
   with urllib.request.urlopen(req,timeout=20) as r:d=json.loads(r.read(1500000))
   return d["choices"][0]["message"]["content"]
  except (OSError,ValueError,KeyError,IndexError,urllib.error.URLError):return None
 def local(self,m):
  q=m.lower()
  if any(x in q for x in ("hello","hi","नमस्ते")):return "नमस्ते! मैं OpenJarvis लोकल मोड हूँ।"
  if "craftland" in q:return "मैं Craftland blueprint JSON बना सकता हूँ।"
  return "यह लोकल मोड सीमित है। अधिक सक्षम AI के लिए अपनी अधिकृत OpenAI-compatible सेवा को environment variables से जोड़ें।"
