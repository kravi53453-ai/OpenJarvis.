import ast,time
from pathlib import Path
from .logger import log
def health(root):
 result={}
 for name in ("app.py","core/state_manager.py","core/chat_engine.py","freefire_craftland/blueprint.py"):
  try:ast.parse((Path(root)/name).read_text()); result[name]="syntax_ok"
  except Exception as e:result[name]="syntax_error"; log(name,e)
 result["checked_at"]=time.time(); result["policy"]="diagnose and report; never rewrite executable code automatically"
 return result
