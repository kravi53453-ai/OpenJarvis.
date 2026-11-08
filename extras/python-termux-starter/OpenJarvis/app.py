from http.server import ThreadingHTTPServer,BaseHTTPRequestHandler
from pathlib import Path
import json,urllib.parse
from core.state_manager import State
from core.chat_engine import Chat
from core.device_info import info
from debugger.self_heal import health
from freefire_craftland.blueprint import build
BASE=Path(__file__).resolve().parent
db=State(BASE/"data/openjarvis.db"); ai=Chat(db)
class H(BaseHTTPRequestHandler):
 def out(self,x,status=200,kind="application/json"):
  b=(json.dumps(x,ensure_ascii=False) if kind.startswith("application") else x).encode()
  self.send_response(status); self.send_header("Content-Type",kind+"; charset=utf-8"); self.send_header("Content-Length",str(len(b))); self.end_headers(); self.wfile.write(b)
 def do_GET(self):
  p=urllib.parse.urlparse(self.path).path
  if p=="/": self.out((BASE/"static/index.html").read_text(),kind="text/html")
  elif p=="/api/device": self.out(info())
  elif p=="/api/health": self.out(health(BASE))
  elif p=="/api/history": self.out({"messages":db.history()})
  else:self.out({"error":"not found"},404)
 def do_POST(self):
  try:
   n=min(int(self.headers.get("Content-Length",0)),1000000); x=json.loads(self.rfile.read(n) or b"{}")
   p=urllib.parse.urlparse(self.path).path
   if p=="/api/chat": self.out({"reply":ai.reply(str(x.get("message",""))[:10000])})
   elif p=="/api/learn": db.note(str(x.get("title","Note"))[:120],str(x.get("content",""))[:20000]); self.out({"saved":True})
   elif p=="/api/blueprint":
    v=build(x); d=BASE/"data/blueprints"; d.mkdir(parents=True,exist_ok=True); (d/(v["slug"]+".json")).write_text(json.dumps(v,indent=2))
    self.out({"saved":True,"blueprint":v})
   else:self.out({"error":"not found"},404)
  except Exception as e:
   from debugger.logger import log
   log("http",e); self.out({"error":"request failed; see system_crash.log"},500)
 def log_message(self,*a): pass
if __name__=="__main__":
 (BASE/"data").mkdir(exist_ok=True); s=ThreadingHTTPServer(("127.0.0.1",8765),H)
 print("OpenJarvis: http://127.0.0.1:8765")
 try:s.serve_forever()
 except KeyboardInterrupt:pass
 finally:s.server_close()
