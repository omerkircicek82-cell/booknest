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

public class BookNestApi : IHttpHandler {
  static readonly object SaveLock = new object();
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
  string ReadUrl(string url) {
    ServicePointManager.SecurityProtocol |= SecurityProtocolType.Tls12;
    var r=(HttpWebRequest)WebRequest.Create(url);r.Method="GET";r.AllowAutoRedirect=false;r.Timeout=9000;r.ReadWriteTimeout=9000;r.UserAgent="BookNest/1.0";r.AutomaticDecompression=DecompressionMethods.GZip|DecompressionMethods.Deflate;
    using(var response=(HttpWebResponse)r.GetResponse()) {
      if(response.StatusCode!=HttpStatusCode.OK)throw new Exception("Kaynak erişimi başarısız.");
      using(var stream=response.GetResponseStream())using(var ms=new MemoryStream()) { var buffer=new byte[8192];int n;while((n=stream.Read(buffer,0,buffer.Length))>0){if(ms.Length+n>2000000)throw new Exception("Kaynak yanıtı büyük.");ms.Write(buffer,0,n);}return Encoding.UTF8.GetString(ms.ToArray()); }
    }
  }
  string ReadContent(HttpContext c) { string file=c.Server.MapPath("~/App_Data/content.json");return File.ReadAllText(File.Exists(file)?file:c.Server.MapPath("~/content.json")); }
  object Lookup(string query) {
    string q=(query??"").Trim();if(q.Length<2||q.Length>200)throw new ArgumentException("Kitap adı veya ISBN 2–200 karakter olmalı.");
    var results=new List<object>();var warnings=new List<string>();int failed=0;
    try {
      string search=Regex.IsMatch(Isbn(q),@"^(\d{13}|\d{9}[\dX])$")?"isbn:"+Isbn(q):q;
      var data=O(Json.DeserializeObject(ReadUrl("https://www.googleapis.com/books/v1/volumes?maxResults=8&printType=books&q="+Uri.EscapeDataString(search))));
      foreach(var item in A(V(data,"items"))) {
        var v=O(item);var i=O(V(v,"volumeInfo"));var ids=A(V(i,"industryIdentifiers")).Select(O).ToList();var id=ids.FirstOrDefault(x=>S(x,"type")=="ISBN_13")??ids.FirstOrDefault();var images=O(V(i,"imageLinks"));
        results.Add(new {source="Google Books",id=S(v,"id"),title=S(i,"title"),author=String.Join(", ",A(V(i,"authors"))),desc=Clean(S(i,"description")),pages=S(i,"pageCount"),publisher=S(i,"publisher"),year=S(i,"publishedDate").Split('-')[0],isbn=S(id,"identifier"),cover=S(images,"thumbnail").Replace("http://","https://")});
      }
    } catch { failed++;warnings.Add("Google Books şu anda kullanılamıyor."); }
    try {
      var data=O(Json.DeserializeObject(ReadUrl("https://openlibrary.org/search.json?limit=8&fields=key,title,author_name,isbn,publisher,first_publish_year,number_of_pages_median,cover_i&q="+Uri.EscapeDataString(q))));
      foreach(var item in A(V(data,"docs"))) {var i=O(item);var ids=A(V(i,"isbn")).Select(Convert.ToString).ToArray();string cover=S(i,"cover_i");results.Add(new {source="Open Library",id=S(i,"key"),title=S(i,"title"),author=String.Join(", ",A(V(i,"author_name"))),desc="",pages=S(i,"number_of_pages_median"),publisher=Convert.ToString(A(V(i,"publisher")).FirstOrDefault()),year=S(i,"first_publish_year"),isbn=ids.FirstOrDefault(x=>x.Length==13)??ids.FirstOrDefault()??"",cover=cover==""?"":"https://covers.openlibrary.org/b/id/"+cover+"-L.jpg"});}
    } catch { failed++;warnings.Add("Open Library şu anda kullanılamıyor."); }
    if(failed==2)throw new Exception("Kitap kaynaklarına ulaşılamadı. Sunucunun dış ağ erişimini kontrol edin; bilgileri elle de girebilirsiniz.");
    return new {items=results,warnings=warnings};
  }
  void Products(object obj,List<IDictionary<string,object>> products) {
    var o=O(obj);if(o==null){foreach(var child in A(obj))Products(child,products);return;}
    var types=A(V(o,"@type")).Select(Convert.ToString).ToList();types.Add(S(o,"@type"));if(types.Contains("Product")||types.Contains("Book"))products.Add(o);
    if(o.ContainsKey("@graph"))Products(o["@graph"],products);if(o.ContainsKey("mainEntity"))Products(o["mainEntity"],products);
  }
  decimal? Price(string html,string expected) {
    if(!Regex.IsMatch(expected,@"^(\d{13}|\d{9}[\dX])$"))return null;
    var products=new List<IDictionary<string,object>>();
    foreach(Match m in Regex.Matches(html,"<script\\b[^>]*type\\s*=\\s*[\"']application/ld\\+json[\"'][^>]*>([\\s\\S]*?)</script>",RegexOptions.IgnoreCase)) {try{Products(Json.DeserializeObject(m.Groups[1].Value),products);}catch{}}
    decimal? best=null;
    foreach(var p in products.Where(p=>new[]{"isbn","gtin13","gtin","gtin14"}.Any(k=>Isbn(S(p,k))==expected))) {
      var offers=O(V(p,"offers"))!=null?new[]{V(p,"offers")}:A(V(p,"offers"));
      foreach(var offer in offers) {var o=O(offer);decimal n;string raw=S(o,"price");
        if(S(o,"priceCurrency")=="TRY"&&Regex.IsMatch(S(o,"availability"),@"^(https?://schema.org/)?InStock$")&&(S(o,"@type")==""||S(o,"@type")=="Offer")&&Regex.IsMatch(raw,@"^\d+(\.\d{1,2})?$")&&Decimal.TryParse(raw,System.Globalization.NumberStyles.AllowDecimalPoint,System.Globalization.CultureInfo.InvariantCulture,out n)&&n>0&&n<10000000&&(!best.HasValue||n<best.Value))best=n;
      }
    }
    return best;
  }
  object Prices(HttpContext c,IDictionary<string,object> book) {
    string key="prices_"+Json.Serialize(book);var cached=c.Cache[key];if(cached!=null)return cached;
    string q=Uri.EscapeDataString(S(book,"isbn")!=""?S(book,"isbn"):S(book,"title")+" "+S(book,"author"));
    var searches=new[]{new {store=Stores[0],url="https://www.dr.com.tr/search?q="+q},new {store=Stores[1],url="https://www.kitapyurdu.com/index.php?route=product/search&filter_name="+q},new {store=Stores[2],url="https://www.bkmkitap.com/arama?q="+q},new {store=Stores[3],url="https://www.idefix.com/arama?q="+q}};
    var offers=new List<IDictionary<string,object>>();var warnings=new List<string>();
    var urls=A(V(book,"priceUrls")).Select(Convert.ToString).Concat(new[]{S(book,"buyUrl")}).Where(x=>Retailer(x)>=0).Distinct().Take(8);
    foreach(string url in urls) {int r=Retailer(url);try {var n=Price(ReadUrl(url),Isbn(S(book,"isbn")));if(n.HasValue)offers.Add(new Dictionary<string,object>{{"store",Stores[r]},{"url",url},{"price",n.Value},{"shipping",null},{"currency","TRY"},{"checkedAt",DateTime.UtcNow.ToString("o")}});else warnings.Add(Stores[r]+": aynı ISBN için stokta ve TRY cinsinden doğrulanabilir fiyat bulunamadı.");}catch{warnings.Add(Stores[r]+": satıcı sayfası okunamadı.");}}
    var result=new {offers=offers.OrderBy(x=>(decimal)x["price"]).ToArray(),searches=searches,warnings=warnings,checkedAt=DateTime.UtcNow.ToString("o"),scope="Tanımlı satıcı bağlantılarında aynı ISBN için doğrulanabilen ürün fiyatları. Kargo dahil değildir."};
    c.Cache.Insert(key,result,null,DateTime.UtcNow.AddMinutes(5),System.Web.Caching.Cache.NoSlidingExpiration);return result;
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
    c.Response.TrySkipIisCustomErrors=true;c.Response.ContentType="application/json";c.Response.ContentEncoding=Encoding.UTF8;c.Response.Cache.SetCacheability(HttpCacheability.NoCache);c.Response.Cache.SetNoStore();c.Response.Headers["X-Content-Type-Options"]="nosniff";
    string action=c.Request.QueryString["action"]??"";
    try {
      if(c.Request.HttpMethod=="POST"&&c.Request.Headers["Origin"]!=null){Uri origin;if(!Uri.TryCreate(c.Request.Headers["Origin"],UriKind.Absolute,out origin)||origin.Authority!=c.Request.Url.Authority){Fail(c,403,"İstek kaynağı geçersiz.");return;}}
      if(action=="content") {if(c.Request.HttpMethod!="GET"){Fail(c,405,"GET gerekli.");return;}Out(c,200,Json.DeserializeObject(ReadContent(c)));return;}
      if(action=="prices") {if(c.Request.HttpMethod!="GET"){Fail(c,405,"GET gerekli.");return;}var data=O(Json.DeserializeObject(ReadContent(c)));var book=A(V(data,"books")).Select(O).FirstOrDefault(b=>Slug(S(b,"title"))==c.Request.QueryString["book"]);if(book==null){Fail(c,404,"Kitap bulunamadı.");return;}Out(c,200,Prices(c,book));return;}
      if(action=="books") {if(c.Request.HttpMethod!="GET"){Fail(c,405,"GET gerekli.");return;}if(!Auth(c)){Fail(c,401,"Giriş gerekli.");return;}Out(c,200,Lookup(c.Request.QueryString["q"]));return;}
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
      if(action=="logout"){c.Cache.Remove("session_"+c.Request.Cookies["bn_session"].Value);Cookie(c,"",-1);Out(c,200,new{ok=true});return;}
      if(action=="save") {
        if(c.Request.ContentLength>1000000){Fail(c,413,"İstek çok büyük.");return;}string body;using(var reader=new StreamReader(c.Request.InputStream,Encoding.UTF8))body=reader.ReadToEnd();if(body.Length>1000000)throw new ArgumentException("İçerik çok büyük.");var d=O(Json.DeserializeObject(body));Validate(d);
        string file=c.Server.MapPath("~/App_Data/content.json"),backup=c.Server.MapPath("~/App_Data/content.bak.json"),temp=c.Server.MapPath("~/App_Data/content.tmp.json");
        lock(SaveLock){Directory.CreateDirectory(c.Server.MapPath("~/App_Data"));File.WriteAllText(temp,Json.Serialize(d),new UTF8Encoding(false));if(File.Exists(file))File.Replace(temp,file,backup);else {File.Copy(c.Server.MapPath("~/content.json"),backup,true);File.Move(temp,file);}}
        Out(c,200,new{ok=true,msg="Kaydedildi"});return;
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
    }catch(ArgumentException e){Fail(c,400,e.Message);}catch(UnauthorizedAccessException){Fail(c,500,"Kayıt izni yok. IIS uygulama havuzuna App_Data ve img klasörleri için Modify izni verin.");}catch(Exception e){System.Diagnostics.Trace.TraceError("BookNest: "+e);Fail(c,502,action=="books"?"Kitap kaynaklarına ulaşılamadı. Sunucunun dış ağ erişimini kontrol edin.":"İşlem tamamlanamadı. IIS günlüklerini ve klasör izinlerini kontrol edin.");}
  }
}
