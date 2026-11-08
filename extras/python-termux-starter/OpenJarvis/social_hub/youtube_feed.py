import urllib.request,xml.etree.ElementTree as ET
def channel_feed(channel_id):
 if not channel_id.startswith("UC"):raise ValueError("public YouTube channel ID required")
 u="https://www.youtube.com/feeds/videos.xml?channel_id="+channel_id
 req=urllib.request.Request(u,headers={"User-Agent":"OpenJarvis/1.0"})
 with urllib.request.urlopen(req,timeout=15) as r:root=ET.fromstring(r.read(1000000))
 ns={"a":"http://www.w3.org/2005/Atom","yt":"http://www.youtube.com/xml/schemas/2015"}
 return [{"title":e.findtext("a:title",default="",namespaces=ns),"video_id":e.findtext("yt:videoId",default="",namespaces=ns),"published":e.findtext("a:published",default="",namespaces=ns)} for e in root.findall("a:entry",ns)]
