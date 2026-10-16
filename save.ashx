<%@ WebHandler Language="C#" Class="BookNestApi" %>
using System;
using System.IO;
using System.Text;
using System.Web;
using System.Web.Script.Serialization;
using System.Configuration;
using System.Collections;
using System.Collections.Generic;
using System.Linq;
using System.Net;
using System.Security.Cryptography;
using System.Text.RegularExpressions;
using LiteDB;

public class BookNestApi : IHttpHandler {
  static readonly object SaveLock = new object();
  static readonly object DatabaseLock = new object();
  static readonly string[] Hosts = { "dr.com.tr", "kitapyurdu.com", "bkmkitap.com", "idefix.com" };
  static readonly string[] Stores = { "D&R", "Kitapyurdu", "BKM Kitap", "İdefix" };
  JavaScriptSerializer Json = new JavaScriptSerializer { MaxJsonLength = 2000000 };
  public bool IsReusable { get { return false; } }
  string S(IDictionary<string,object> o, string k) { return o != null && o.ContainsKey(k) && o[k] != null ? Convert.ToString(o[k], System.Globalization.CultureInfo.InvariantCulture) : ""; }
  IDictionary<string,object> O(object o) { return o as IDictionary<string,object>; }
  IEnumerable<object> A(object o) { return o is object[] ? (object[])o : o is ArrayList ? ((ArrayList)o).Cast<object>() : new object[0]; }
  object V(IDictionary<string,object> o, string k) { return o != null && o.ContainsKey(k) ? o[k] : null; }
  string Clean(string s) { return Regex.Replace(Regex.Replace(s ?? "", "<[^>]*>", " "), @"\s+", " ").Trim(); }
  string Isbn(string s) { return Regex.Replace(s ?? "", @"[-\s]", "").ToUpperInvariant(); }
  string Slug(string s) {
    string n=(s??"").Normalize(NormalizationForm.FormD);
    n=Regex.Replace(n,@"\p{Mn}","").ToLowerInvariant().Replace("ı","i");
    return Regex.Replace(n,"[^a-z0-9]+","-").Trim('-');
  }
  void Out(HttpContext c, int status, object value) { c.Response.StatusCode=status; c.Response.Write(Json.Serialize(value)); }
  void Fail(HttpContext c, int status, string msg) { Out(c,status,new {ok=false,msg=msg}); }
  bool Auth(HttpContext c) { var cookie=c.Request.Cookies["bn_session"]; return cookie != null && c.Cache["session_"+cookie.Value] != null; }
  bool Equal(string a,string b) { using(var h=SHA256.Create()){var x=h.ComputeHash(Encoding.UTF8.GetBytes(a??""));var y=h.ComputeHash(Encoding.UTF8.GetBytes(b??""));int d=0;for(int i=0;i<x.Length;i++)d|=x[i]^y[i];return d==0;} }
  void Cookie(HttpContext c,string value,int hours) { c.Response.AppendHeader("Set-Cookie","bn_session="+value+"; HttpOnly; SameSite=Strict; Path=/; Expires="+DateTime.UtcNow.AddHours(hours).ToString("R",System.Globalization.CultureInfo.InvariantCulture)+(c.Request.IsSecureConnection?"; Secure":"")); }
  int Retailer(string url) { Uri u;if(!Uri.TryCreate(url,UriKind.Absolute,out u)||u.Scheme!="https"||u.Port!=443||u.UserInfo!="")return -1;return Array.FindIndex(Hosts,h=>u.Host==h||u.Host=="www."+h); }
  object ParseJson(string text) { return new JavaScriptSerializer { MaxJsonLength=2000000, RecursionLimit=80 }.DeserializeObject(text); }
  string Decode(string text) { return HttpUtility.HtmlDecode(text??""); }
  string Language(string value) {
    string s=Slug((value??"").Split('/').Last());return s=="tr"||s=="tur"||s=="turkce"||s=="turkish"||s.StartsWith("tr-")?"tr":s=="en"||s=="eng"||s=="english"||s=="ingilizce"||s.StartsWith("en-")?"en":s;
  }
  string NormalIsbn(string value) { string s=Regex.Replace(value??"",@"^\s*ISBN(?:-1[03])?\s*:?\s*","",RegexOptions.IgnoreCase);s=Isbn(s);return Regex.IsMatch(s,@"^(\d{13}|\d{9}[\dX])$")?s:""; }
  string Isbn13(string value) {
    string s=NormalIsbn(value);if(s.Length!=10)return s;string n="978"+s.Substring(0,9);int sum=0;for(int i=0;i<12;i++)sum+=(n[i]-'0')*(i%2==0?1:3);return n+((10-sum%10)%10).ToString();
  }
  bool SameIsbn(string a,string b) { return NormalIsbn(a)!=""&&NormalIsbn(b)!=""&&Isbn13(a)==Isbn13(b); }
  string PageFailure(Exception error) {
    var w=error as WebException;if(w!=null) {
      var response=w.Response as HttpWebResponse;if(response!=null) {int status=(int)response.StatusCode;response.Close();if(status==403)return "HTTP 403: kaynak otomatik isteği engelledi; ürün bağlantısını tarayıcıda açın veya ürün akışı/API kullanın.";if(status==429)return "HTTP 429: kaynak sorgu kotası/istek sınırı doldu; bu, kitabın bulunmadığı anlamına gelmez. Bir süre sonra yeniden deneyin.";if(status==404)return "HTTP 404: ürün veya kaynak bulunamadı.";return "HTTP "+status+": kaynak yanıtı alınamadı.";}
      if(w.Status==WebExceptionStatus.Timeout)return "İstek zaman aşımına uğradı; sunucunun dış ağ erişimini kontrol edin.";
      if(w.Status==WebExceptionStatus.TrustFailure||w.Status==WebExceptionStatus.SecureChannelFailure)return "HTTPS/TLS bağlantısı doğrulanamadı; sunucunun sertifika deposunu kontrol edin.";
      return "Kaynağa bağlanılamadı ("+w.Status+"); sunucunun dış ağ erişimini kontrol edin.";
    }
    return error is ArgumentException?error.Message:"Kaynak yanıtı okunamadı veya beklenen biçimde değil.";
  }
  bool AllowedUrl(string url) {
    if(Retailer(url)>=0)return true;Uri u;if(!Uri.TryCreate(url,UriKind.Absolute,out u)||u.Scheme!="https"||u.Port!=443||u.UserInfo!="")return false;
    return u.Host=="www.googleapis.com"&&u.AbsolutePath=="/books/v1/volumes"||u.Host=="openlibrary.org"&&(u.AbsolutePath=="/search.json"||Regex.IsMatch(u.AbsolutePath,@"^/(books/OL\d+M|authors/OL\d+A)\.json$"));
  }
  string DecodePage(byte[] bytes,string charset) {
    string head=Encoding.ASCII.GetString(bytes,0,Math.Min(bytes.Length,4096));
    if(String.IsNullOrEmpty(charset)) {var m=Regex.Match(head,"charset\\s*=\\s*[\"']?([a-z0-9_-]+)",RegexOptions.IgnoreCase);if(m.Success)charset=m.Groups[1].Value;}
    Encoding encoding=Encoding.UTF8;
    if(!String.IsNullOrEmpty(charset)){try{encoding=Encoding.GetEncoding(charset.Trim(' ','\"','\''));}catch(ArgumentException){}}
    using(var stream=new MemoryStream(bytes))using(var reader=new StreamReader(stream,encoding,true))return reader.ReadToEnd();
  }
  string ReadUrl(string url) { return ReadPage(url,DateTime.UtcNow.AddSeconds(7)); }
  string ReadPage(string url,DateTime deadline) {
    if(!AllowedUrl(url))throw new ArgumentException("Yalnızca desteklenen HTTPS kitap kaynakları kullanılabilir.");
    ServicePointManager.SecurityProtocol|=SecurityProtocolType.Tls12;int retailer=Retailer(url);Uri initial=new Uri(url);string current=url;
    for(int redirects=0;redirects<=3;redirects++) {
      int timeout=Math.Min(6000,(int)(deadline-DateTime.UtcNow).TotalMilliseconds);if(timeout<100)throw new WebException("Zaman aşımı",WebExceptionStatus.Timeout);
      var request=(HttpWebRequest)WebRequest.Create(current);request.Method="GET";request.AllowAutoRedirect=false;request.Timeout=timeout;request.ReadWriteTimeout=timeout;request.UserAgent="BookNest/1.1 (+https://thebooknest.online)";request.Accept="text/html,application/json;q=0.9,*/*;q=0.8";request.Headers[HttpRequestHeader.AcceptLanguage]="tr-TR,tr;q=0.9";request.AutomaticDecompression=DecompressionMethods.GZip|DecompressionMethods.Deflate;request.ServicePoint.ConnectionLimit=8;
      using(var response=(HttpWebResponse)request.GetResponse()) {
        int status=(int)response.StatusCode;
        if(status>=300&&status<400) {
          Uri next;if(redirects==3||!Uri.TryCreate(new Uri(current),response.Headers["Location"],out next)||!AllowedUrl(next.AbsoluteUri)||(retailer>=0?Retailer(next.AbsoluteUri)!=retailer:next.Host!=initial.Host))throw new ArgumentException("Kaynak desteklenmeyen adrese yönlendirdi.");current=next.AbsoluteUri;continue;
        }
        if(status!=200)throw new ArgumentException("Kaynak HTTP "+status+" döndürdü.");
        using(var stream=response.GetResponseStream())using(var ms=new MemoryStream()){var buffer=new byte[8192];int n;while((n=stream.Read(buffer,0,buffer.Length))>0){if(DateTime.UtcNow>=deadline)throw new WebException("Zaman aşımı",WebExceptionStatus.Timeout);if(ms.Length+n>2000000)throw new ArgumentException("Kaynak yanıtı 2 MB sınırını aşıyor.");ms.Write(buffer,0,n);}var cm=Regex.Match(response.ContentType??"","charset\\s*=\\s*[\"']?([a-z0-9_-]+)",RegexOptions.IgnoreCase);return DecodePage(ms.ToArray(),cm.Success?cm.Groups[1].Value:"");}
      }
    }
    throw new ArgumentException("Çok fazla kaynak yönlendirmesi.");
  }
  string ReadContent(HttpContext c) { string file=c.Server.MapPath("~/App_Data/content.json");return File.ReadAllText(File.Exists(file)?file:c.Server.MapPath("~/content.json")); }
  string DatabasePath(HttpContext c) { return c.Server.MapPath("~/App_Data/catalog.db"); }
  LiteDatabase OpenDatabase(string path) {
    if(String.IsNullOrEmpty(path))throw new IOException("Yerel veritabanı yolu belirlenemedi.");
    Directory.CreateDirectory(Path.GetDirectoryName(path));
    return new LiteDatabase(new ConnectionString {Filename=path,Connection=ConnectionType.Shared});
  }
  string DatabaseFailure(Exception e) { return "Yerel kitap veritabanı açılamadı veya kaydedilemedi. App_Data klasörüne IIS uygulama havuzu için Modify izni verin; bin/LiteDB.dll ve bin/System.Buffers.dll dosyalarını ve .NET Framework 4.8 kurulumunu kontrol edin. ("+SafeDiagnostic(e.GetType().Name+": "+e.Message,500)+")"; }
  string SafeDiagnostic(string text,int limit) {
    string value=Regex.Replace(text??"",@"https?://[^\s<>\""']+",m=>{Uri u;if(!Uri.TryCreate(m.Value,UriKind.Absolute,out u))return "[bağlantı]";return u.Scheme+"://"+u.Host+u.AbsolutePath;},RegexOptions.IgnoreCase);
    value=Regex.Replace(value,@"(?i)\b(password|pass|token|api[_-]?key|authorization|secret|cookie)\b\s*[:=]\s*[^\s,;]+","$1=[gizlendi]");
    value=Clean(value);return value.Length>limit?value.Substring(0,limit):value;
  }
  void RecordDiagnostics(string path,string category,string book,IEnumerable<string> messages) {
    var clean=(messages??new string[0]).Select(x=>SafeDiagnostic(x,1200)).Where(x=>x!="").Distinct().ToArray();if(clean.Length==0)return;
    lock(DatabaseLock)using(var db=OpenDatabase(path)) {
      var log=db.GetCollection<BsonDocument>("diagnostics");log.EnsureIndex("createdAt");
      foreach(string message in clean)log.Insert(new BsonDocument {{"_id",ObjectId.NewObjectId()},{"createdAt",DateTime.UtcNow.ToString("o")},{"category",SafeDiagnostic(category,80)},{"book",SafeDiagnostic(book,240)},{"message",message}});
      foreach(var row in log.FindAll().OrderByDescending(x=>x["_id"].AsObjectId).Skip(200).ToArray())log.Delete(row["_id"]);
    }
  }
  void TryRecordDiagnostics(string path,string category,string book,IEnumerable<string> messages) {
    try {RecordDiagnostics(path,category,book,messages);}catch(Exception e){System.Diagnostics.Trace.TraceError("BookNest local log: "+SafeDiagnostic(e.GetType().Name+": "+e.Message,500));}
  }
  void LogDiagnostics(HttpContext c,string category,string book,IEnumerable<string> messages) {try {RecordDiagnostics(DatabasePath(c),category,book,messages);}catch(Exception e){System.Diagnostics.Trace.TraceError("BookNest local log: "+SafeDiagnostic(e.GetType().Name+": "+e.Message,500));}}
  string HashKey(string value) {using(var h=SHA256.Create())return BitConverter.ToString(h.ComputeHash(Encoding.UTF8.GetBytes(value))).Replace("-","");}
  string SafeSourceUrl(string value) {
    Uri u;if(!Uri.TryCreate(value,UriKind.Absolute,out u)||u.Scheme!="https"||u.Port!=443||u.UserInfo!="")return "";
    string host=u.Host.ToLowerInvariant();if(Retailer(value)>=0&&host.StartsWith("www."))host=host.Substring(4);
    var query=HttpUtility.ParseQueryString(u.Query);var parts=new List<string>();foreach(string key in query.AllKeys.Where(x=>x!=null).OrderBy(x=>x,StringComparer.Ordinal)) {
      if(Regex.IsMatch(key,@"^(utm_.*|s_token|token|access_token|refresh_token|api[_-]?key|key|secret|password|pass|authorization|signature|sig|ref|referrer|fbclid|gclid|campaign)$",RegexOptions.IgnoreCase))continue;
      foreach(string entry in query.GetValues(key).OrderBy(x=>x,StringComparer.Ordinal))parts.Add(Uri.EscapeDataString(key)+"="+Uri.EscapeDataString(entry));
    }return "https://"+host+u.AbsolutePath+(parts.Count==0?"":"?"+String.Join("&",parts));
  }
  string MetadataUrl(IDictionary<string,object> item) {string url=S(item,"productUrl");if(url=="")url=S(item,"sourceUrl");return Retailer(url)>=0?SafeSourceUrl(url):"";}
  IDictionary<string,object> MetadataFields(IDictionary<string,object> item) {
    var copy=new Dictionary<string,object>();foreach(string key in new[]{"source","id","title","author","desc","pages","publisher","year","isbn","cover","language","sourceUrl","productUrl"})if(S(item,key)!="")copy[key]=S(item,key);
    foreach(string key in new[]{"sourceUrl","productUrl"})if(copy.ContainsKey(key))copy[key]=SafeSourceUrl(S(copy,key));
    if(S(copy,"id").StartsWith("https://",StringComparison.OrdinalIgnoreCase)||S(copy,"id").StartsWith("http://",StringComparison.OrdinalIgnoreCase))copy["id"]=SafeSourceUrl(S(copy,"id"));
    copy["isbn"]=NormalIsbn(S(item,"isbn"));copy["language"]=Language(S(item,"language"));return copy;
  }
  bool UsefulMetadata(IDictionary<string,object> item) { return S(item,"title")!=""&&(NormalIsbn(S(item,"isbn"))!=""||S(item,"desc")!=""||S(item,"pages")!=""||S(item,"publisher")!=""); }
  void StoreMetadata(string path,IEnumerable<IDictionary<string,object>> items) {
    var records=new List<BsonDocument>();foreach(var raw in items??new IDictionary<string,object>[0]) {
      if(raw==null||!UsefulMetadata(raw))continue;var item=MetadataFields(raw);string source=S(item,"source");if(source=="")source="Yönetici";item["source"]=source;
      string identity=MetadataUrl(item);if(identity=="")identity=S(item,"id");if(identity=="")identity=S(item,"sourceUrl");if(identity==""&&NormalIsbn(S(item,"isbn"))==""){if(source!="Yönetici")continue;identity="manual:"+HashKey(Slug(S(item,"title"))+"|"+Slug(S(item,"author"))+"|"+Slug(S(item,"publisher"))+"|"+S(item,"year")+"|"+S(item,"pages"));item["id"]=identity;}if(identity=="")identity="isbn:"+Isbn13(S(item,"isbn"));
      string key=HashKey(Isbn13(S(item,"isbn"))+"|"+Language(S(item,"language"))+"|"+source+"|"+identity);
      records.Add(new BsonDocument {{"_id",key},{"isbn",Isbn13(S(item,"isbn"))},{"titleKey",Slug(S(item,"title"))},{"authorKey",Slug(S(item,"author"))},{"language",Language(S(item,"language"))},{"urlKey",MetadataUrl(item)},{"metadata",Json.Serialize(item)},{"cachedAt",DateTime.UtcNow.ToString("o")}});
    }
    if(records.Count==0)return;
    lock(DatabaseLock)using(var db=OpenDatabase(path)){var collection=db.GetCollection<BsonDocument>("books");collection.EnsureIndex("isbn");collection.EnsureIndex("urlKey");foreach(var record in records)collection.Upsert(record);}
  }
  string SeedExistingMetadata(HttpContext c) {
    try {
      string path=DatabasePath(c);lock(DatabaseLock){using(var db=OpenDatabase(path)){if(db.GetCollection<BsonDocument>("books").Count()>0)return "";}
        var content=O(Json.DeserializeObject(ReadContent(c)));StoreMetadata(path,A(V(content,"books")).Select(O));}
      return "";
    }catch(Exception e){string warning=DatabaseFailure(e);LogDiagnostics(c,"database","Mevcut kitapların aktarımı",new[]{warning});return warning;}
  }
  List<IDictionary<string,object>> LocalLookup(string path,string query,IDictionary<string,object> context) {
    string q=(query??"").Trim();context=context??new Dictionary<string,object>();var expected=new Dictionary<string,object>(context);if(S(expected,"language")=="")expected["language"]="tr";
    bool direct=Retailer(q)>=0;string isbn=NormalIsbn(S(expected,"isbn"));if(NormalIsbn(q)!=""){isbn=NormalIsbn(q);expected["isbn"]=isbn;}if(!direct&&isbn==""&&S(expected,"title")=="")expected["title"]=q;
    var result=new List<IDictionary<string,object>>();
    lock(DatabaseLock)using(var db=OpenDatabase(path)) {
      var collection=db.GetCollection<BsonDocument>("books");IEnumerable<BsonDocument> rows=direct?collection.Find(Query.EQ("urlKey",SafeSourceUrl(q))):isbn!=""?collection.Find(Query.EQ("isbn",Isbn13(isbn))):collection.FindAll();
      foreach(var row in rows.OrderByDescending(x=>x["cachedAt"].AsString)) {var item=O(Json.DeserializeObject(row["metadata"].AsString));if(item!=null&&MatchesBook(item,expected)){item["cachedAt"]=row["cachedAt"].AsString;item["local"]=true;result.Add(item);if(result.Count>=50)break;}}
    }return result;
  }
  object LookupCached(string path,string query,IDictionary<string,object> context,bool refresh) {
    string q=(query??"").Trim();if(q.Length<2||q.Length>1500)throw new ArgumentException("Kitap adı, ISBN veya desteklenen mağaza ürün bağlantısı girin (2–1500 karakter).");
    if((q.StartsWith("http://",StringComparison.OrdinalIgnoreCase)||q.StartsWith("https://",StringComparison.OrdinalIgnoreCase))&&Retailer(q)<0)throw new ArgumentException("D&R, Kitapyurdu, BKM Kitap veya İdefix HTTPS ürün bağlantısı kullanın.");
    var localWarnings=new List<string>();if(!refresh)try{var saved=LocalLookup(path,q,context);if(saved.Count>0)return new{items=saved,warnings=localWarnings,fromCache=true,local=true};}catch(Exception e){localWarnings.Add(DatabaseFailure(e));}
    var data=O(Json.DeserializeObject(Json.Serialize(Lookup(q,context))));return CompleteLookup(path,q,A(V(data,"items")).Select(O).Where(x=>x!=null).ToArray(),A(V(data,"warnings")).Select(Convert.ToString).Concat(localWarnings));
  }
  object CompleteLookup(string path,string query,IEnumerable<IDictionary<string,object>> results,IEnumerable<string> sourceWarnings) {
    var items=results.ToArray();var warnings=sourceWarnings.ToList();
    try{StoreMetadata(path,items);}catch(Exception e){warnings.Add(DatabaseFailure(e));}
    TryRecordDiagnostics(path,"books",query,warnings);return new {items=items,warnings=warnings.Distinct().ToArray(),fromCache=false,local=false};
  }
  object Diagnostics(string path) {
    lock(DatabaseLock)using(var db=OpenDatabase(path)) {
      var entries=db.GetCollection<BsonDocument>("diagnostics").FindAll().OrderByDescending(x=>x["_id"].AsObjectId).Select(x=>new{id=x["_id"].AsObjectId.ToString(),createdAt=x["createdAt"].AsString,category=x["category"].AsString,book=x["book"].AsString,message=x["message"].AsString}).ToArray();
      return new {entries=entries,database=new{kind="LiteDB",count=db.GetCollection<BsonDocument>("books").Count(),path="App_Data/catalog.db"}};
    }
  }
  void ClearDiagnostics(string path) {lock(DatabaseLock)using(var db=OpenDatabase(path))db.GetCollection<BsonDocument>("diagnostics").DeleteAll();}
  object LocalBooks(string path,string query) {
    string q=Slug(query??"");lock(DatabaseLock)using(var db=OpenDatabase(path)) {
      var collection=db.GetCollection<BsonDocument>("books");var items=collection.FindAll().Where(x=>q==""||x["titleKey"].AsString.Contains(q)||x["authorKey"].AsString.Contains(q)||x["isbn"].AsString.Contains(q)).OrderByDescending(x=>x["cachedAt"].AsString).Take(100).Select(x=>{var item=O(Json.DeserializeObject(x["metadata"].AsString));item["cachedAt"]=x["cachedAt"].AsString;item["local"]=true;return item;}).ToArray();return new{items=items,count=collection.Count()};
    }
  }
  string NameValue(object value) {var d=O(value);if(d!=null)return Clean(Decode(S(d,"name")));var a=A(value).ToArray();return a.Length>0?String.Join(", ",a.Select(NameValue).Where(x=>x!="")):Clean(Decode(Convert.ToString(value)));}
  IEnumerable<string> Words(string text) {return Slug(text).Split('-').Where(x=>x.Length>1);}
  bool Similar(string expected,string actual,double minimum) {
    var a=Words(expected).Distinct().ToArray();var b=Words(actual).Distinct().ToArray();if(a.Length==0)return true;if(b.Length==0)return false;return (double)a.Intersect(b).Count()/a.Length>=minimum&&(double)a.Intersect(b).Count()/b.Length>=0.4;
  }
  bool MatchesBook(IDictionary<string,object> item,IDictionary<string,object> context) {
    string requested=Language(S(context,"language"));if(requested=="")requested="tr";string found=Language(S(item,"language"));if(requested!="all"&&found!=""&&found!=requested)return false;
    string isbn=NormalIsbn(S(context,"isbn"));if(isbn!="")return SameIsbn(isbn,S(item,"isbn"));
    return Similar(S(context,"title"),S(item,"title"),0.8)&&Similar(S(context,"author"),S(item,"author"),0.6);
  }
  string GoogleQuery(IDictionary<string,object> context,string query,bool titleOnly) {
    string isbn=NormalIsbn(S(context,"isbn"));if(isbn!="")return "isbn:"+isbn;string title=S(context,"title");if(title=="")title=query;
    return "intitle:\""+title.Replace("\"","")+"\""+(titleOnly||S(context,"author")==""?"":" inauthor:\""+S(context,"author").Replace("\"","")+"\"");
  }
  List<IDictionary<string,object>> GoogleItems(string payload,IDictionary<string,object> context) {
    var results=new List<IDictionary<string,object>>();var data=O(ParseJson(payload));if(V(data,"error")!=null)throw new ArgumentException("Google Books hata yanıtı döndürdü.");
    foreach(var raw in A(V(data,"items"))) {
      var item=O(raw);var i=O(V(item,"volumeInfo"));var ids=A(V(i,"industryIdentifiers")).Select(O).ToArray();var id=ids.FirstOrDefault(x=>S(x,"type")=="ISBN_13")??ids.FirstOrDefault();var images=O(V(i,"imageLinks"));
      var result=new Dictionary<string,object>{{"source","Google Books"},{"id",S(item,"id")},{"title",NameValue(V(i,"title"))},{"author",NameValue(V(i,"authors"))},{"desc",Clean(Decode(S(i,"description")))},{"pages",S(i,"pageCount")},{"publisher",NameValue(V(i,"publisher"))},{"year",S(i,"publishedDate").Split('-')[0]},{"isbn",NormalIsbn(S(id,"identifier"))},{"cover",S(images,"thumbnail").Replace("http://","https://")},{"language",Language(S(i,"language"))},{"sourceUrl",S(i,"infoLink").Replace("http://","https://")}};
      if(MatchesBook(result,context)&&S(result,"title")!="")results.Add(result);
    }
    return results;
  }
  IDictionary<string,object> EditionItem(string payload,IDictionary<string,object> context,string author) {
    var e=O(ParseJson(payload));var languages=A(V(e,"languages")).Select(O).Select(x=>Language(S(x,"key").Split('/').Last())).ToArray();string requested=Language(S(context,"language"));if(requested=="")requested="tr";if(requested!="all"&&!languages.Contains(requested))return null;string actualLanguage=languages.FirstOrDefault(x=>x=="tr")??languages.FirstOrDefault()??"";
    string isbn=A(V(e,"isbn_13")).Select(Convert.ToString).Concat(A(V(e,"isbn_10")).Select(Convert.ToString)).Select(NormalIsbn).FirstOrDefault(x=>x!=""&&(NormalIsbn(S(context,"isbn"))==""||SameIsbn(x,S(context,"isbn"))))??"";
    string description=S(e,"description");var descriptionObject=O(V(e,"description"));if(descriptionObject!=null)description=S(descriptionObject,"value");string cover=Convert.ToString(A(V(e,"covers")).FirstOrDefault());
    var item=new Dictionary<string,object>{{"source","Open Library"},{"id",S(e,"key")},{"title",S(e,"title")},{"author",author},{"desc",Clean(Decode(description))},{"pages",S(e,"number_of_pages")},{"publisher",NameValue(V(e,"publishers"))},{"year",Regex.Match(S(e,"publish_date"),@"\b\d{4}\b").Value},{"isbn",isbn},{"cover",Regex.IsMatch(cover??"",@"^\d+$")?"https://covers.openlibrary.org/b/id/"+cover+"-L.jpg":""},{"language",actualLanguage},{"sourceUrl","https://openlibrary.org"+S(e,"key")}};
    return MatchesBook(item,context)?item:null;
  }
  List<IDictionary<string,object>> LookupGoogle(string q,IDictionary<string,object> context,List<string> warnings,DateTime deadline) {
    var items=new List<IDictionary<string,object>>();try {
      string language=Language(S(context,"language"));if(language=="")language="tr";
      string root="https://www.googleapis.com/books/v1/volumes?maxResults=12&printType=books"+(language=="all"?"":"&langRestrict="+Uri.EscapeDataString(language))+"&country=TR&q=";
      items=GoogleItems(ReadPage(root+Uri.EscapeDataString(GoogleQuery(context,q,false)),deadline),context);
      if(items.Count==0&&S(context,"author")!=""&&NormalIsbn(S(context,"isbn"))=="")items=GoogleItems(ReadPage(root+Uri.EscapeDataString(GoogleQuery(context,q,true)),deadline),context);
      if(items.Count==0)warnings.Add("Google Books: başlık, yazar ve Türkçe baskı koşullarına uyan kayıt bulunamadı. Mağaza ürün bağlantısıyla içe aktarabilirsiniz.");
    }catch(Exception e){warnings.Add("Google Books: "+PageFailure(e));}return items;
  }
  List<IDictionary<string,object>> LookupOpenLibrary(string q,IDictionary<string,object> context,List<string> warnings,DateTime deadline) {
    var items=new List<IDictionary<string,object>>();try {
      string isbn=NormalIsbn(S(context,"isbn"));string title=S(context,"title");string language=Language(S(context,"language"));string lang=language=="en"?"eng":"tur";
      string search=isbn!=""?"isbn:"+isbn:"title:\""+(title!=""?title:q).Replace("\"","")+"\""+(S(context,"author")==""?"":" author:\""+S(context,"author").Replace("\"","")+"\"");
      string url="https://openlibrary.org/search.json?limit=4&fields=key,title,author_name,editions,editions.key,editions.language&lang="+(language=="en"?"en":"tr")+"&q="+Uri.EscapeDataString(search+(language=="all"?"":" language:"+lang));
      var data=O(ParseJson(ReadPage(url,deadline)));var seen=new HashSet<string>();int fetched=0;
      foreach(var raw in A(V(data,"docs"))) {
        var work=O(raw);string author=NameValue(V(work,"author_name"));if(!Similar(S(context,"title"),S(work,"title"),0.8)||!Similar(S(context,"author"),author,0.6))continue;
        var editions=O(V(work,"editions"));foreach(var candidate in A(V(editions,"docs"))) {
          string key=S(O(candidate),"key");if(!Regex.IsMatch(key,@"^(/books/)?OL\d+M$"))continue;if(!key.StartsWith("/books/"))key="/books/"+key;if(!seen.Add(key)||fetched>=4)continue;fetched++;
          try {var item=EditionItem(ReadPage("https://openlibrary.org"+key+".json",deadline),context,author);if(item!=null)items.Add(item);}catch(Exception e){warnings.Add("Open Library baskısı: "+PageFailure(e));}
        }
      }
      if(items.Count==0)warnings.Add("Open Library: doğrulanmış Türkçe baskı bulunamadı; karma dilde eser ISBN'leri kullanılmadı.");
    }catch(Exception e){warnings.Add("Open Library: "+PageFailure(e));}return items;
  }
  List<IDictionary<string,object>> LookupRetail(string query,IDictionary<string,object> context,List<string> warnings,DateTime deadline) {
    var output=new List<IDictionary<string,object>>();string search=NormalIsbn(S(context,"isbn"));if(search=="")search=S(context,"title")==""?query:S(context,"title");string url=SearchUrl(1,search);
    try {var urls=SearchCandidates(ReadPage(url,deadline),url,S(context,"title"));if(urls.Count==0)warnings.Add("Kitapyurdu: arama sayfasında kitap bağlantısı bulunamadı; doğrudan ürün bağlantısını yapıştırın.");
      foreach(string productUrl in urls) {try {var item=RetailMetadata(ReadPage(productUrl,deadline),productUrl,S(context,"isbn"));if(item!=null&&MatchesBook(item,context))output.Add(item);}catch(Exception e){warnings.Add("Kitapyurdu ürün bilgisi: "+PageFailure(e));}}
      if(output.Count==0)warnings.Add("Kitapyurdu: başlık, yazar ve Türkçe baskıyla uyuşan ürün bilgisi bulunamadı. Doğru ürün sayfasının adresiyle içe aktarın.");
    }catch(Exception e){warnings.Add("Kitapyurdu kitap araması: "+PageFailure(e));}return output;
  }
  object Lookup(string query,IDictionary<string,object> context) {
    string q=(query??"").Trim();if(q.Length<2||q.Length>1500)throw new ArgumentException("Kitap adı, ISBN veya desteklenen mağaza ürün bağlantısı girin (2–1500 karakter).");
    context=context??new Dictionary<string,object>();if(S(context,"language")=="")context["language"]="tr";if(NormalIsbn(q)!="")context["isbn"]=NormalIsbn(q);
    var results=new List<IDictionary<string,object>>();var warnings=new List<string>();DateTime deadline=DateTime.UtcNow.AddSeconds(25);
    if(q.StartsWith("https://",StringComparison.OrdinalIgnoreCase)||q.StartsWith("http://",StringComparison.OrdinalIgnoreCase)) {
      int retailer=Retailer(q);if(retailer<0)throw new ArgumentException("D&R, Kitapyurdu, BKM Kitap veya İdefix HTTPS ürün bağlantısı kullanın.");
      try{var metadata=RetailMetadata(ReadPage(q,deadline),q,S(context,"isbn"));if(metadata!=null&&MatchesBook(metadata,context))results.Add(metadata);else warnings.Add(Stores[retailer]+": ürün bilgisi bulunamadı veya başlık/yazar/dil/baskı uyuşmuyor. Doğrudan kitabın ürün sayfasını kullanın.");}catch(Exception e){warnings.Add(Stores[retailer]+": "+PageFailure(e));}
      return new {items=results,warnings=warnings};
    }
    if(S(context,"title")==""&&NormalIsbn(q)=="")context["title"]=q;
    var googleWarnings=new List<string>();var libraryWarnings=new List<string>();var retailWarnings=new List<string>();List<IDictionary<string,object>> google=null,library=null,retail=null;
    var jobs=new Action[]{()=>google=LookupGoogle(q,context,googleWarnings,deadline),()=>library=LookupOpenLibrary(q,context,libraryWarnings,deadline),()=>retail=LookupRetail(q,context,retailWarnings,deadline)};
    System.Threading.Tasks.Parallel.Invoke(new System.Threading.Tasks.ParallelOptions {MaxDegreeOfParallelism=3},jobs);
    results.AddRange(google??new List<IDictionary<string,object>>());results.AddRange(library??new List<IDictionary<string,object>>());warnings.AddRange(googleWarnings);warnings.AddRange(libraryWarnings);if(results.Count==0){results.AddRange(retail??new List<IDictionary<string,object>>());warnings.AddRange(retailWarnings);}
    if(results.Count==0)warnings.Add("Kitap kaynaklarında olmayan kitaplar için D&R/Kitapyurdu/BKM Kitap/İdefix ürün adresini arama alanına yapıştırın; mağazada bulunması Google Books veya Open Library'de kayıtlı olduğu anlamına gelmez.");
    return new {items=results.GroupBy(x=>S(x,"source")+"|"+S(x,"id")+"|"+S(x,"isbn")).Select(x=>x.First()).ToArray(),warnings=warnings};
  }
  void Products(object obj,List<IDictionary<string,object>> products) {
    var o=O(obj);if(o==null){foreach(var child in A(obj))Products(child,products);return;}
    var types=A(V(o,"@type")).Select(Convert.ToString).Concat(new[]{S(o,"@type")}).Select(x=>x.Split('/').Last());if(types.Any(x=>x=="Product"||x=="Book"))products.Add(o);
    foreach(string key in new[]{"@graph","mainEntity","itemOffered"})if(o.ContainsKey(key))Products(o[key],products);
  }
  List<IDictionary<string,object>> LinkedProducts(string html) {
    var products=new List<IDictionary<string,object>>();var graph=new Dictionary<string,IDictionary<string,object>>();
    foreach(Match m in Regex.Matches(html,"<script\\b[^>]*type\\s*=\\s*[\"']application/ld\\+json(?:;[^\"']*)?[\"'][^>]*>([\\s\\S]*?)</script>",RegexOptions.IgnoreCase)) {try{var root=ParseJson(m.Groups[1].Value.Trim());Products(root,products);CollectGraph(root,graph);}catch{}}
    foreach(var p in products){foreach(string key in new[]{"offers","author","publisher","image"}) {var linked=O(V(p,key));if(linked!=null&&S(linked,"@id")!=""&&graph.ContainsKey(S(linked,"@id")))p[key]=graph[S(linked,"@id")];else if(V(p,key) is object[])p[key]=A(V(p,key)).Select(x=>{var d=O(x);return d!=null&&graph.ContainsKey(S(d,"@id"))?(object)graph[S(d,"@id")]:x;}).ToArray();}}
    string canonical=Meta(Metas(html),"og:url");if(canonical=="")foreach(Match match in Regex.Matches(html,"<link\\b[^>]*>",RegexOptions.IgnoreCase)){var attrs=Attributes(match.Value);if(Attr(attrs,"rel").ToLowerInvariant()=="canonical"){canonical=Attr(attrs,"href");break;}}
    if(canonical!=""){string identity=PageIdentity(canonical);var primary=products.Where(p=>PageIdentity(S(p,"url")==""?S(p,"@id"):S(p,"url"))==identity).ToArray();if(identity!=""&&primary.Length>0){var ids=primary.Select(ProductIsbn).Where(x=>x!="").ToArray();return products.Where(p=>primary.Contains(p)||ids.Any(id=>SameIsbn(ProductIsbn(p),id))).ToList();}}
    return products;
  }
  string PageIdentity(string value) {Uri u;if(!Uri.TryCreate(value,UriKind.Absolute,out u)||u.Scheme!="https")return "";return u.GetLeftPart(UriPartial.Path);}
  IEnumerable<IDictionary<string,object>> AllProducts(string html) {var linked=LinkedProducts(html);var ids=linked.Select(ProductIsbn).Where(x=>x!="").ToArray();return linked.Concat(MarkupProducts(html).Where(p=>ids.Length==0||ids.Any(id=>SameIsbn(ProductIsbn(p),id))));}
  void CollectGraph(object value,Dictionary<string,IDictionary<string,object>> graph) {var d=O(value);if(d==null){foreach(var x in A(value))CollectGraph(x,graph);return;}if(S(d,"@id")!=""&&d.Count>1)graph[S(d,"@id")]=d;foreach(var x in d.Values)if(O(x)!=null||x is object[]||x is ArrayList)CollectGraph(x,graph);}
  Dictionary<string,string> Attributes(string tag) {
    var values=new Dictionary<string,string>(StringComparer.OrdinalIgnoreCase);foreach(Match m in Regex.Matches(tag,"([\\w:-]+)\\s*=\\s*(?:\"([^\"]*)\"|'([^']*)'|([^\\s>]+))")){values[m.Groups[1].Value]=Decode(m.Groups[2].Success?m.Groups[2].Value:m.Groups[3].Success?m.Groups[3].Value:m.Groups[4].Value);}return values;
  }
  string Attr(IDictionary<string,string> values,string name) {return values.ContainsKey(name)?values[name]:"";}
  Dictionary<string,string> Metas(string html) {var values=new Dictionary<string,string>(StringComparer.OrdinalIgnoreCase);foreach(Match m in Regex.Matches(html,"<meta\\b[^>]*>",RegexOptions.IgnoreCase)){var a=Attributes(m.Value);string key=Attr(a,"property");if(key=="")key=Attr(a,"name");if(key!=""&&!values.ContainsKey(key))values[key]=Attr(a,"content");}return values;}
  string Meta(IDictionary<string,string> metas,params string[] names) {foreach(string n in names)if(metas.ContainsKey(n)&&metas[n]!="")return metas[n];return "";}
  class MarkupNode {public string Tag;public Dictionary<string,string> Attrs;public int Start,End,OpenEnd;public MarkupNode Parent;public List<MarkupNode> Children=new List<MarkupNode>();}
  List<MarkupNode> Markup(string html) {
    var nodes=new List<MarkupNode>();var stack=new List<MarkupNode>();int skipUntil=0;
    foreach(Match m in Regex.Matches(html,"</?[a-zA-Z][^>]*>",RegexOptions.Singleline)) {
      if(m.Index<skipUntil)continue;var tm=Regex.Match(m.Value,@"^<(\/?)([a-zA-Z0-9]+)");string tag=tm.Groups[2].Value.ToLowerInvariant();
      if(tm.Groups[1].Value=="/"){int index=stack.FindLastIndex(x=>x.Tag==tag);if(index>=0){for(int i=stack.Count-1;i>=index;i--){stack[i].End=m.Index;stack.RemoveAt(i);}}continue;}
      var n=new MarkupNode{Tag=tag,Attrs=Attributes(m.Value),Start=m.Index,OpenEnd=m.Index+m.Length,End=html.Length,Parent=stack.LastOrDefault()};if(n.Parent!=null)n.Parent.Children.Add(n);nodes.Add(n);
      if(tag=="script"||tag=="style"){var end=Regex.Match(html.Substring(n.OpenEnd),"</"+tag+"\\s*>",RegexOptions.IgnoreCase);if(end.Success){n.End=n.OpenEnd+end.Index;skipUntil=n.OpenEnd+end.Index+end.Length;}continue;}
      if(!Regex.IsMatch(tag,@"^(area|base|br|col|embed|hr|img|input|link|meta|param|source|track|wbr)$")&&!m.Value.EndsWith("/>"))stack.Add(n);else n.End=n.OpenEnd;
    }return nodes;
  }
  bool ProductNode(MarkupNode node) {return Regex.IsMatch(Attr(node.Attrs,"itemtype"),@"(?:^|\s)https?://schema\.org/(Product|Book)(?:\s|$)",RegexOptions.IgnoreCase);}
  string NodeValue(MarkupNode node,string html) {string content=Attr(node.Attrs,"content");if(content!="")return content;string href=Attr(node.Attrs,"href");if(href!="")return href;string src=Attr(node.Attrs,"src");return src!=""?src:Clean(Decode(html.Substring(node.OpenEnd,Math.Max(0,node.End-node.OpenEnd))));}
  IEnumerable<MarkupNode> ScopedNodes(MarkupNode product,List<MarkupNode> nodes) {return nodes.Where(x=>{var p=x.Parent;while(p!=null&&p!=product){if(ProductNode(p))return false;p=p.Parent;}return p==product;});}
  List<IDictionary<string,object>> MarkupProducts(string html) {
    var output=new List<IDictionary<string,object>>();var nodes=Markup(html);
    foreach(var scope in nodes.Where(ProductNode)) {
      var p=new Dictionary<string,object>();foreach(var node in ScopedNodes(scope,nodes))foreach(string prop in Attr(node.Attrs,"itemprop").Split(' ').Where(x=>x!="")){if(new[]{"isbn","gtin13","gtin","gtin12","gtin14","name","author","publisher","numberOfPages","description","image","inLanguage","sku"}.Contains(prop)&&!p.ContainsKey(prop))p[prop]=NodeValue(node,html);}
      var offers=new List<object>();var scoped=ScopedNodes(scope,nodes).ToArray();var offerRoots=scoped.Where(x=>Regex.IsMatch(Attr(x.Attrs,"itemtype"),@"schema\.org/Offer\b",RegexOptions.IgnoreCase)).ToArray();
      if(offerRoots.Length==0)offerRoots=new[]{scope};foreach(var offer in offerRoots){var o=new Dictionary<string,object>{{"@type","Offer"}};foreach(var node in scoped.Where(x=>{for(var parent=x.Parent;parent!=null;parent=parent.Parent){if(parent==offer)return true;if(parent==scope)return offer==scope;}return false;}))foreach(string prop in Attr(node.Attrs,"itemprop").Split(' ')){if(new[]{"price","priceCurrency","availability"}.Contains(prop))o[prop]=NodeValue(node,html);}if(o.ContainsKey("price"))offers.Add(o);}p["offers"]=offers.ToArray();output.Add(p);
    }
    var meta=Metas(html);string kind=Meta(meta,"og:type");string isbn=Meta(meta,"book:isbn","product:isbn","isbn","books:isbn");
    if((kind=="product"||kind=="book"||kind=="books.book")&&NormalIsbn(isbn)!="") {
      var p=new Dictionary<string,object>{{"name",Meta(meta,"og:title","twitter:title")},{"isbn",isbn},{"author",Meta(meta,"book:author","books:author","author")},{"publisher",Meta(meta,"book:publisher","publisher")},{"description",Meta(meta,"og:description","description")},{"image",Meta(meta,"og:image")},{"inLanguage",Meta(meta,"og:locale","book:language")},{"offers",new[]{new Dictionary<string,object>{{"price",Meta(meta,"product:price:amount","og:price:amount","product:price")},{"priceCurrency",Meta(meta,"product:price:currency","og:price:currency")},{"availability",Meta(meta,"product:availability","og:availability")}}}}};output.Add(p);
    }
    return output;
  }
  string ProductIsbn(IDictionary<string,object> product) {
    foreach(string key in new[]{"isbn","gtin13","gtin","gtin14"}) {string n=NormalIsbn(S(product,key));if(n!="")return n;}
    string sku=NormalIsbn(S(product,"sku"));return sku;
  }
  string ImageValue(object value) {var d=O(value);if(d!=null)return S(d,"url")==""?S(d,"contentUrl"):S(d,"url");var a=A(value).ToArray();return a.Length>0?ImageValue(a[0]):Convert.ToString(value);}
  IDictionary<string,object> RetailMetadata(string html,string url,string expected) {
    var products=AllProducts(html).ToList();string normalized=NormalIsbn(expected);var p=products.FirstOrDefault(x=>S(x,"name")!=""&&(normalized==""||SameIsbn(ProductIsbn(x),normalized)));if(p==null)return null;
    var meta=Metas(html);string language=Language(NameValue(V(p,"inLanguage")));
    string title=Clean(Decode(S(p,"name")));string publisher=NameValue(V(p,"publisher"));string author=NameValue(V(p,"author"));string isbn=ProductIsbn(p);
    // Supplement only from another representation of the same exact edition.
    foreach(var supplement in products.Where(x=>isbn!=""&&SameIsbn(ProductIsbn(x),isbn))) {if(author=="")author=NameValue(V(supplement,"author"));if(publisher=="")publisher=NameValue(V(supplement,"publisher"));foreach(string field in new[]{"numberOfPages","datePublished","description","inLanguage"})if(S(p,field)==""&&S(supplement,field)!="")p[field]=supplement[field];}
    string editionLanguage=Language(NameValue(V(p,"inLanguage")));if(editionLanguage!="")language=editionLanguage;
    string cover=ImageValue(V(p,"image"));if(String.IsNullOrEmpty(cover))cover=Meta(meta,"og:image");Uri image;if(Uri.TryCreate(new Uri(url),cover,out image)&&image.Scheme=="https")cover=image.AbsoluteUri;else cover="";
    return new Dictionary<string,object>{{"source",Stores[Retailer(url)]},{"id",url},{"sourceUrl",url},{"productUrl",url},{"title",title},{"author",author},{"desc",Clean(Decode(S(p,"description")))},{"publisher",publisher},{"pages",S(p,"numberOfPages")},{"year",S(p,"datePublished").Split('-')[0]},{"isbn",isbn},{"cover",cover},{"language",language}};
  }
  decimal? DecimalPrice(string value) {
    string raw=Decode(value).Trim().Replace("\u00a0","").Replace(" ","");if(!Regex.IsMatch(raw,@"^\d+(?:[.,]\d+)*$"))return null;
    int comma=raw.LastIndexOf(','),dot=raw.LastIndexOf('.');
    if(comma>=0&&dot>=0){char dec=comma>dot?',':'.',group=dec==','?'.':',';if(!Regex.IsMatch(raw,dec==','?@"^\d{1,3}(?:\.\d{3})*,\d{1,2}$":@"^\d{1,3}(?:,\d{3})*\.\d{1,2}$"))return null;raw=raw.Replace(group.ToString(),"").Replace(dec,'.');}
    else if(comma>=0||dot>=0){char sep=comma>=0?',':'.';if(!Regex.IsMatch(raw,@"^\d+[.,]\d{1,2}$"))return null;raw=raw.Replace(sep,'.');}
    decimal number;return Decimal.TryParse(raw,System.Globalization.NumberStyles.AllowDecimalPoint,System.Globalization.CultureInfo.InvariantCulture,out number)&&number>0&&number<10000000?(decimal?)number:null;
  }
  bool Unavailable(string availability) {string a=Slug(availability.Split('/').Last());return new[]{"outofstock","out-of-stock","soldout","sold-out","discontinued","preorder","pre-order","presale","pre-sale","backorder","back-order","onbackorder","not-available","unavailable","stokta-yok","tukendi"}.Contains(a);}
  IDictionary<string,object> PriceEvidence(string html,string expected) {
    if(NormalIsbn(expected)=="")return null;var metas=Metas(html);if(SameIsbn(Meta(metas,"book:isbn","product:isbn","isbn","books:isbn"),expected)&&Unavailable(Meta(metas,"product:availability","og:availability")))return null;IDictionary<string,object> best=null;
    foreach(var p in AllProducts(html).Where(x=>SameIsbn(ProductIsbn(x),expected))) {
      if(Unavailable(S(p,"availability")))continue;var offers=O(V(p,"offers"))!=null?new[]{V(p,"offers")}:A(V(p,"offers"));
      foreach(var offer in offers) {var o=O(offer);string type=S(o,"@type").Split('/').Last();if(type!=""&&type!="Offer")continue;string availability=S(o,"availability");if(Unavailable(availability)||S(o,"priceCurrency").ToUpperInvariant()!="TRY")continue;
        decimal? price=DecimalPrice(S(o,"price"));if(!price.HasValue)continue;string stock=Regex.IsMatch(availability,@"^(https?://schema.org/)?(InStock|LimitedAvailability|OnlineOnly)$",RegexOptions.IgnoreCase)?"in_stock":"unknown";
        if(best==null||price.Value<(decimal)best["price"])best=new Dictionary<string,object>{{"price",price.Value},{"stockStatus",stock}};
      }
    }return best;
  }
  decimal? Price(string html,string expected) {var result=PriceEvidence(html,expected);return result==null?null:(decimal?)result["price"];}
  string SearchUrl(int retailer,string query) {string q=Uri.EscapeDataString(query);return new[]{"https://www.dr.com.tr/search?q="+q,"https://www.kitapyurdu.com/index.php?route=product/search&filter_name="+q,"https://www.bkmkitap.com/arama?q="+q,"https://www.idefix.com/arama?q="+q}[retailer];}
  bool ProductPath(string url) {var u=new Uri(url);string path=u.AbsolutePath.ToLowerInvariant();if(path=="/"||Regex.IsMatch(path,@"/(search|arama|kategori|category|yazar|yayinevi)(/|$)")||u.Query.Contains("route=product/search"))return false;int r=Retailer(url);return r==0?path.StartsWith("/kitap/"):r==1?path.StartsWith("/kitap/")||u.Query.Contains("route=product/product"):r==2?path.Split('/').Last().Length>3:path.Contains("-p-")||path.StartsWith("/kitap/");}
  List<string> SearchCandidates(string html,string searchUrl,string title="") {
    int retailer=Retailer(searchUrl);var urls=new List<string>();
    Action<string> add=value=>{Uri u;if(String.IsNullOrWhiteSpace(value)||!Uri.TryCreate(new Uri(searchUrl),Decode(value),out u)||Retailer(u.AbsoluteUri)!=retailer||!ProductPath(u.AbsoluteUri))return;
      string clean=u.AbsolutePath.EndsWith(".html",StringComparison.OrdinalIgnoreCase)?u.GetLeftPart(UriPartial.Path):new UriBuilder(u){Fragment=""}.Uri.AbsoluteUri;
      if(!urls.Contains(clean))urls.Add(clean);};
    foreach(var product in LinkedProducts(html)){string url=S(product,"url");if(url=="")url=S(product,"@id");if(title==""||Similar(title,S(product,"name"),0.6))add(url);}
    foreach(Match m in Regex.Matches(html,"<a\\b([^>]*)>([\\s\\S]*?)</a\\s*>",RegexOptions.IgnoreCase)) {var attrs=Attributes(m.Groups[1].Value);string value=Attr(attrs,"href");if(value=="")continue;
      string label=Clean(Decode(m.Groups[2].Value));if(title!=""&&!Similar(title,label,0.6)&&!Similar(title,Uri.UnescapeDataString(value.Split('?')[0]),0.6))continue;add(value);if(urls.Count>=3)break;}
    return urls.Take(3).ToList();
  }
  class StorePrices {public List<IDictionary<string,object>> Offers=new List<IDictionary<string,object>>();public List<string> Warnings=new List<string>();}
  StorePrices CheckStore(int retailer,string isbn,string title,List<string> explicitUrls,DateTime deadline) {
    var output=new StorePrices();var urls=explicitUrls.Where(x=>Retailer(x)==retailer).Distinct().Take(2).ToList();
    if(urls.Count==0) {try{string search=SearchUrl(retailer,isbn);urls=SearchCandidates(ReadPage(search,deadline),search,title);
      if(urls.Count==0&&title!=""){search=SearchUrl(retailer,title);urls=SearchCandidates(ReadPage(search,deadline),search,title);}
      if(urls.Count==0)output.Warnings.Add(Stores[retailer]+": arama sayfasında ürün bağlantısı bulunamadı; panelde doğrudan ürün bağlantısı ekleyin. Sayfa JavaScript gerektirebilir.");}catch(Exception e){output.Warnings.Add(Stores[retailer]+" araması: "+PageFailure(e));return output;}}
    foreach(string url in urls) {
      if(DateTime.UtcNow>=deadline){output.Warnings.Add(Stores[retailer]+": fiyat kontrolü zaman sınırına ulaştı; doğrudan ürün bağlantısıyla tekrar deneyin.");break;}
      try{string html=ReadPage(url,deadline);var evidence=PriceEvidence(html,isbn);if(evidence!=null){output.Warnings.Clear();output.Offers.Add(new Dictionary<string,object>{{"store",Stores[retailer]},{"url",url},{"price",evidence["price"]},{"stockStatus",evidence["stockStatus"]},{"shipping",null},{"currency","TRY"},{"checkedAt",DateTime.UtcNow.ToString("o")}});break;}
        var products=AllProducts(html).ToArray();var matched=products.Where(x=>SameIsbn(ProductIsbn(x),isbn)).ToArray();string reason=matched.Length==0?"aynı ISBN için ürün kanıtı yok; doğru baskının doğrudan ürün bağlantısını ekleyin":matched.Any(p=>Unavailable(S(p,"availability"))||A(V(p,"offers")).Concat(new[]{V(p,"offers")}).Select(O).Any(o=>Unavailable(S(o,"availability"))))?"ürün stok dışı veya ön siparişte":"aynı ISBN bulundu fakat okunabilir TRY ürün fiyatı yok; mağaza sayfası JavaScript veya ürün akışı/API gerektirebilir";
        output.Warnings.Add(Stores[retailer]+": "+reason+".");
      }catch(Exception e){output.Warnings.Add(Stores[retailer]+": "+PageFailure(e));}
    }return output;
  }
  object Prices(HttpContext c,IDictionary<string,object> book) {
    string key="prices_v2_"+Json.Serialize(book);var cached=c.Cache[key];if(cached!=null)return cached;
    string isbn=NormalIsbn(S(book,"isbn"));string query=isbn!=""?isbn:S(book,"title")+" "+S(book,"author");var searches=Enumerable.Range(0,4).Select(r=>new {store=Stores[r],url=SearchUrl(r,query)}).ToArray();
    var warnings=new List<string>();var offers=new List<IDictionary<string,object>>();var supplied=A(V(book,"priceUrls")).Select(Convert.ToString).Concat(new[]{S(book,"buyUrl")}).Where(x=>!String.IsNullOrWhiteSpace(x)).Distinct().ToArray();var urls=supplied.Where(x=>Retailer(x)>=0).Take(8).ToList();
    if(supplied.Any(x=>Retailer(x)<0))warnings.Add("Desteklenmeyen satıcı bağlantıları atlandı; yalnızca D&R, Kitapyurdu, BKM Kitap ve İdefix HTTPS ürün bağlantıları kullanın.");
    if(isbn=="")warnings.Add("Fiyatları karşılaştırmak için bu kitaba ait ISBN-13/ISBN-10 gerekli. Panelde Türkçe baskıyı seçin veya mağazanın ürün bağlantısından ISBN bilgisini içe aktarın.");
    else {if(urls.Count==0)warnings.Add("Tanımlı ürün bağlantısı yok; dört mağazada ISBN ile ürün araması deneniyor. Engellenen aramalar için panelde doğrudan ürün bağlantısı ekleyin.");DateTime deadline=DateTime.UtcNow.AddSeconds(25);var stores=new StorePrices[4];System.Threading.Tasks.Parallel.For(0,4,new System.Threading.Tasks.ParallelOptions {MaxDegreeOfParallelism=4},r=>stores[r]=CheckStore(r,isbn,S(book,"title"),urls,deadline));foreach(var store in stores){offers.AddRange(store.Offers);warnings.AddRange(store.Warnings);}}
    LogDiagnostics(c,"prices",S(book,"title")+(isbn==""?"":" ["+isbn+"]"),warnings);
    var result=new {offers=offers.OrderBy(x=>(decimal)x["price"]).ToArray(),searches=searches,checkedAt=DateTime.UtcNow.ToString("o"),scope="Aynı ISBN için mağaza sayfalarında gözlenen TRY ürün fiyatları. Stok bilgisi belirtilmeyen teklifler işaretlenir. Kargo dahil değildir."};
    c.Cache.Insert(key,result,null,DateTime.UtcNow.AddSeconds(offers.Count>0?300:30),System.Web.Caching.Cache.NoSlidingExpiration);return result;
  }
  void Validate(IDictionary<string,object> d) {
    if(d==null)throw new ArgumentException("Geçersiz içerik.");foreach(string k in new[]{"site","texts","about"})if(O(V(d,k))==null)throw new ArgumentException(k+" eksik.");
    foreach(string k in new[]{"books","series","journal","ritual","photos","quotes"})if(!(V(d,k) is object[])&&!(V(d,k) is ArrayList))throw new ArgumentException(k+" liste olmalı.");
    var names=new HashSet<string>();var books=A(V(d,"books")).ToArray();if(books.Length>500)throw new ArgumentException("En fazla 500 kitap.");
    foreach(var item in books){var b=O(item);string title=S(b,"title");if(String.IsNullOrWhiteSpace(title)||Slug(title)==""||!names.Add(Slug(title)))throw new ArgumentException("Kitap adları dolu ve benzersiz olmalı.");
      if(V(b,"priceUrls")!=null&&!(V(b,"priceUrls") is object[])&&!(V(b,"priceUrls") is ArrayList))throw new ArgumentException("Fiyat bağlantıları liste olmalı.");
      var urls=A(V(b,"priceUrls")).Select(Convert.ToString).ToArray();if(urls.Length>8||urls.Any(x=>Retailer(x)<0))throw new ArgumentException("En fazla 8 D&R, Kitapyurdu, BKM Kitap veya İdefix HTTPS ürün bağlantısı girin.");
    }
  }
  public void ProcessRequest(HttpContext c) {
    c.Response.TrySkipIisCustomErrors=true;c.Response.ContentType="application/json";c.Response.ContentEncoding=Encoding.UTF8;c.Response.Charset="utf-8";c.Response.Cache.SetCacheability(HttpCacheability.NoCache);c.Response.Cache.SetNoStore();c.Response.Headers["X-Content-Type-Options"]="nosniff";
    string action=c.Request.QueryString["action"]??"";
    try {
      if(c.Request.HttpMethod=="POST"&&c.Request.Headers["Origin"]!=null){Uri origin;if(!Uri.TryCreate(c.Request.Headers["Origin"],UriKind.Absolute,out origin)||origin.Authority!=c.Request.Url.Authority){Fail(c,403,"İstek kaynağı geçersiz.");return;}}
      if(action=="content") {if(c.Request.HttpMethod!="GET"){Fail(c,405,"GET gerekli.");return;}Out(c,200,Json.DeserializeObject(ReadContent(c)));return;}
      if(action=="prices") {if(c.Request.HttpMethod!="GET"){Fail(c,405,"GET gerekli.");return;}var data=O(Json.DeserializeObject(ReadContent(c)));var book=A(V(data,"books")).Select(O).FirstOrDefault(b=>Slug(S(b,"title"))==c.Request.QueryString["book"]);if(book==null){Fail(c,404,"Kitap bulunamadı.");return;}Out(c,200,Prices(c,book));return;}
      if(action=="books") {if(c.Request.HttpMethod!="GET"){Fail(c,405,"GET gerekli.");return;}if(!Auth(c)){Fail(c,401,"Giriş gerekli.");return;}string seedWarning=SeedExistingMetadata(c);var result=O(Json.DeserializeObject(Json.Serialize(LookupCached(DatabasePath(c),c.Request.QueryString["q"],new Dictionary<string,object>{{"title",c.Request.QueryString["title"]??""},{"author",c.Request.QueryString["author"]??""},{"isbn",c.Request.QueryString["isbn"]??""},{"language",c.Request.QueryString["lang"]??"tr"}},c.Request.QueryString["refresh"]=="1"))));if(seedWarning!="")result["warnings"]=A(V(result,"warnings")).Select(Convert.ToString).Concat(new[]{seedWarning}).Distinct().ToArray();Out(c,200,result);return;}
      if(action=="diagnostics"||action=="local-books") {
        if(c.Request.HttpMethod!="GET"){Fail(c,405,"GET gerekli.");return;}if(!Auth(c)){Fail(c,401,"Giriş gerekli.");return;}
        if(action=="local-books")SeedExistingMetadata(c);Out(c,200,action=="diagnostics"?Diagnostics(DatabasePath(c)):LocalBooks(DatabasePath(c),c.Request.QueryString["q"]));return;
      }
      if(c.Request.HttpMethod!="POST"){Fail(c,405,"POST gerekli.");return;}
      if(action=="login") {
        if(Auth(c)){Out(c,200,new{ok=true});return;}
        string pass=Environment.GetEnvironmentVariable("BOOKNEST_ADMIN_PASSWORD")??ConfigurationManager.AppSettings["AdminPassword"];
        if(String.IsNullOrEmpty(pass)||pass.Length<12){Fail(c,503,"Sunucuda en az 12 karakterlik AdminPassword yapılandırın.");return;}
        if(String.IsNullOrEmpty(c.Request.Headers["X-Admin-Pass"])){Fail(c,401,"Giriş gerekli.");return;}
        string key="fails_"+c.Request.UserHostAddress;int fails=c.Cache[key]==null?0:(int)c.Cache[key];if(fails>=5){Fail(c,429,"Çok fazla deneme. 10 dakika bekleyin.");return;}
        if(!Equal(pass,c.Request.Headers["X-Admin-Pass"])){c.Cache.Insert(key,fails+1,null,DateTime.UtcNow.AddMinutes(10),System.Web.Caching.Cache.NoSlidingExpiration);Fail(c,403,"Şifre hatalı.");return;}
        c.Cache.Remove(key);var bytes=new byte[32];using(var rng=RandomNumberGenerator.Create())rng.GetBytes(bytes);string token=BitConverter.ToString(bytes).Replace("-","");c.Cache.Insert("session_"+token,true,null,DateTime.UtcNow.AddHours(8),System.Web.Caching.Cache.NoSlidingExpiration);Cookie(c,token,8);Out(c,200,new{ok=true});return;
      }
      if(!Auth(c)){Fail(c,401,"Oturum süresi doldu. Yeniden giriş yapın.");return;}
      if(action=="diagnostics-clear"){ClearDiagnostics(DatabasePath(c));Out(c,200,new{ok=true});return;}
      if(action=="logout"){c.Cache.Remove("session_"+c.Request.Cookies["bn_session"].Value);Cookie(c,"",-1);Out(c,200,new{ok=true});return;}
      if(action=="save") {
        if(c.Request.ContentLength>1000000){Fail(c,413,"İstek çok büyük.");return;}string body;using(var reader=new StreamReader(c.Request.InputStream,Encoding.UTF8))body=reader.ReadToEnd();if(body.Length>1000000)throw new ArgumentException("İçerik çok büyük.");var d=O(Json.DeserializeObject(body));Validate(d);
        string file=c.Server.MapPath("~/App_Data/content.json"),backup=c.Server.MapPath("~/App_Data/content.bak.json"),temp=c.Server.MapPath("~/App_Data/content.tmp.json");
        lock(SaveLock){Directory.CreateDirectory(c.Server.MapPath("~/App_Data"));File.WriteAllText(temp,Json.Serialize(d),new UTF8Encoding(false));if(File.Exists(file))File.Replace(temp,file,backup);else {File.Copy(c.Server.MapPath("~/content.json"),backup,true);File.Move(temp,file);}}
        var warnings=new List<string>();try{StoreMetadata(DatabasePath(c),A(V(d,"books")).Select(O));}catch(Exception e){warnings.Add(DatabaseFailure(e));}
        TryRecordDiagnostics(DatabasePath(c),"save","Kitaplık",warnings);Out(c,200,new{ok=true,msg="Kaydedildi",warnings=warnings});return;
      }
      if(action=="upload") {
        string type=c.Request.ContentType??"",ext=type=="image/jpeg"?".jpg":type=="image/png"?".png":type=="image/webp"?".webp":"";if(ext==""){Fail(c,400,"JPG, PNG veya WebP seçin.");return;}
        if(c.Request.ContentLength>5*1024*1024){Fail(c,413,"En fazla 5 MB.");return;}
        using(var ms=new MemoryStream()){c.Request.InputStream.CopyTo(ms);byte[] b=ms.ToArray();if(b.Length<12||b.Length>5*1024*1024){Fail(c,400,"Geçersiz görsel boyutu.");return;}
          bool ok=ext==".jpg"?b[0]==255&&b[1]==216&&b[2]==255:ext==".png"?b.Take(8).SequenceEqual(new byte[]{137,80,78,71,13,10,26,10}):Encoding.ASCII.GetString(b,0,4)=="RIFF"&&Encoding.ASCII.GetString(b,8,4)=="WEBP";if(!ok){Fail(c,400,"Geçersiz görsel.");return;}
          string name=Guid.NewGuid().ToString("N")+ext,dir=c.Server.MapPath("~/img");Directory.CreateDirectory(dir);File.WriteAllBytes(Path.Combine(dir,name),b);Out(c,200,new{ok=true,path="img/"+name});return;
        }
      }
      Fail(c,400,"Bilinmeyen işlem.");
    }catch(Exception e){
      string detail=e is ArgumentException?e.Message:e is UnauthorizedAccessException?"Kayıt izni yok. IIS uygulama havuzuna App_Data ve img klasörleri için Modify izni verin.":action=="diagnostics"||action=="local-books"||action=="diagnostics-clear"?DatabaseFailure(e):"İşlem tamamlanamadı. "+SafeDiagnostic(e.GetType().Name+": "+e.Message,800);
      string logPath=null;try{logPath=DatabasePath(c);}catch{}TryRecordDiagnostics(logPath,action,c.Request.QueryString["book"]??c.Request.QueryString["q"]??"",new[]{detail});
      bool publicRead=action=="content"||action=="prices";Fail(c,e is ArgumentException?400:e is UnauthorizedAccessException?500:502,publicRead?"Şu anda yüklenemiyor. Lütfen biraz sonra tekrar deneyin.":detail);
    }
  }
}
