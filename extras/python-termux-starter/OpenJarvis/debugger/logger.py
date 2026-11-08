import logging
from pathlib import Path
logging.basicConfig(filename=Path(__file__).resolve().parents[1]/"system_crash.log",level=logging.INFO,format="%(asctime)s %(levelname)s %(message)s")
def log(where,error):logging.exception("%s: %s",where,error)
