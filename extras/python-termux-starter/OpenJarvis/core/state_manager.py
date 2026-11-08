import sqlite3,time
from pathlib import Path
class State:
 def __init__(self,p):
  self.p=Path(p); self.p.parent.mkdir(parents=True,exist_ok=True)
  with self.db() as c:c.executescript("CREATE TABLE IF NOT EXISTS msg(id INTEGER PRIMARY KEY,role TEXT,body TEXT,ts REAL); CREATE TABLE IF NOT EXISTS notes(id INTEGER PRIMARY KEY,title TEXT,body TEXT,ts REAL);")
 def db(self):
  c=sqlite3.connect(self.p,timeout=15); c.execute("PRAGMA journal_mode=WAL"); return c
 def add(self,r,b):
  with self.db() as c:c.execute("INSERT INTO msg(role,body,ts) VALUES(?,?,?)",(r,b,time.time()))
 def history(self):
  with self.db() as c: rows=c.execute("SELECT role,body,ts FROM msg ORDER BY id DESC LIMIT 40").fetchall()
  return [{"role":r,"content":b,"time":t} for r,b,t in reversed(rows)]
 def note(self,t,b):
  with self.db() as c:c.execute("INSERT INTO notes(title,body,ts) VALUES(?,?,?)",(t,b,time.time()))
 def search(self,q):
  with self.db() as c:return c.execute("SELECT title,body FROM notes WHERE title LIKE ? OR body LIKE ? ORDER BY id DESC LIMIT 5",("%"+q+"%","%"+q+"%")).fetchall()
