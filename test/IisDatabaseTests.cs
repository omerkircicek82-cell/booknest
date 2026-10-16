// Run against compiled save.ashx with real LiteDB/System.Buffers assemblies.
// Child processes prove persistence survives closing/restarting the application.
using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Linq;
using System.Reflection;
using System.Text;
using System.Web;
using System.Web.Hosting;
using System.Web.Script.Serialization;
class IisDatabaseTests {
  static int count;
  static JavaScriptSerializer Json=new JavaScriptSerializer();
  static object Api;
  static object Call(string name,params object[] args){try{return Api.GetType().GetMethod(name,BindingFlags.Instance|BindingFlags.NonPublic).Invoke(Api,args);}catch(TargetInvocationException e){throw e.InnerException;}}
  static void Check(bool value,string message){if(!value)throw new Exception(message);count++;}
  static Dictionary<string,object> Dict(object value){return (Dictionary<string,object>)Json.DeserializeObject(Json.Serialize(value));}
  static object[] Items(object value){return (object[])Dict(value)["items"];}
  static Dictionary<string,object> Context(string isbn,string language){return new Dictionary<string,object>{{"title","Emare Maske"},{"author","Aslı Arslan"},{"isbn",isbn},{"language",language}};}
  static Dictionary<string,object> Book(string isbn,string language,string id){return new Dictionary<string,object>{{"source","Kitapyurdu"},{"id",id},{"sourceUrl",id},{"productUrl",id},{"title","Emare: Maske"},{"author","Aslı Arslan"},{"isbn",isbn},{"language",language},{"desc","Türkçe açıklama"},{"publisher","Test Yayınevi"},{"price",1},{"offers",new[]{new {price=1}}}};}
  class Worker : SimpleWorkerRequest {
    public readonly MemoryStream Body=new MemoryStream();
    string verb,cookie,origin,body,siteRoot;
    public Worker(string root,string query,string method,string session,string input,string requestOrigin):base("/",root+Path.DirectorySeparatorChar,"save.ashx",query,TextWriter.Null){siteRoot=root;verb=method;cookie=session;body=input;origin=requestOrigin;}
    public override string MapPath(string path){return Path.Combine(siteRoot,path.TrimStart('~','/').Replace('/',Path.DirectorySeparatorChar));}
    public override string GetHttpVerbName(){return verb;}
    public override string GetKnownRequestHeader(int index){if(index==HeaderCookie)return cookie;if(index==HeaderContentType)return body==null?null:"application/json";if(index==HeaderContentLength)return body==null?null:Encoding.UTF8.GetByteCount(body).ToString();return base.GetKnownRequestHeader(index);}
    public override string[][] GetUnknownRequestHeaders(){return origin==null?new string[0][]:new[]{new[]{"Origin",origin}};}
    public override string GetUnknownRequestHeader(string name){return name=="Origin"?origin:null;}
    public override byte[] GetPreloadedEntityBody(){return body==null?new byte[0]:Encoding.UTF8.GetBytes(body);}
    public override bool IsEntireEntityBodyIsPreloaded(){return true;}
    public override int GetTotalEntityBodyLength(){return body==null?0:Encoding.UTF8.GetByteCount(body);}
    public override void SendResponseFromMemory(byte[] bytes,int length){Body.Write(bytes,0,length);}
  }
  static Dictionary<string,object> Request(string root,string query,string method,bool authenticated,string body,string origin,int expected){
    var worker=new Worker(root,query,method,authenticated?"bn_session=db-test":null,body,origin);var context=new HttpContext(worker);if(authenticated)context.Cache["session_db-test"]=true;
    ((IHttpHandler)Api).ProcessRequest(context);context.Response.Flush();string text=new UTF8Encoding(false,true).GetString(worker.Body.ToArray());
    Check(context.Response.StatusCode==expected,"HTTP "+query+" expected "+expected+", got "+context.Response.StatusCode+": "+text);
    return (Dictionary<string,object>)Json.DeserializeObject(text);
  }
  public static void Main(string[] args){
    Api=Activator.CreateInstance(Assembly.LoadFrom(args[0]).GetType("BookNestApi"));
    if(args.Length>2&&(args[2]=="seed"||args[2]=="read")){Child(args[1],args[2]);return;}
    string root=Path.Combine(Path.GetTempPath(),"booknest-localdb-"+Guid.NewGuid().ToString("N"));Directory.CreateDirectory(root);Directory.CreateDirectory(Path.Combine(root,"App_Data"));
    try {
      foreach(string phase in new[]{"seed","read"}){
        var start=new ProcessStartInfo(Environment.GetEnvironmentVariable("BOOKNEST_TEST_MONO")??"mono","\""+Assembly.GetExecutingAssembly().Location+"\" \""+Path.GetFullPath(args[0])+"\" \""+root+"\" "+phase);start.UseShellExecute=false;start.RedirectStandardOutput=true;start.RedirectStandardError=true;
        using(var child=Process.Start(start)){string output=child.StandardOutput.ReadToEnd(),error=child.StandardError.ReadToEnd();child.WaitForExit();Check(child.ExitCode==0,"Separate process "+phase+": "+output+error);Console.Write(output);}
      }
      Check(File.Exists(Path.Combine(root,"App_Data/catalog.db")),"Actual persistent database file");
      Console.WriteLine("PASS: IIS local DB parent checks ("+count+").");
    }finally{Directory.Delete(root,true);}
  }
  static void Child(string root,string phase){
    string path=Path.Combine(root,"App_Data/catalog.db"),product="https://www.kitapyurdu.com/kitap/emare-maske-karton-kapak/750641.html";
    if(phase=="seed"){
      Call("StoreMetadata",path,new[]{Book("9786256372030","tr",product),Book("9786256372047","tr","https://www.kitapyurdu.com/kitap/emare-maske-ciltli/750642.html"),Book("9786256372054","en","https://www.kitapyurdu.com/kitap/emare-english/750643.html")});
      Call("StoreMetadata",path,new[]{new Dictionary<string,object>{{"title","Bare Seed"},{"author","Yazar"}}});
      Call("RecordDiagnostics",path,"books","Emare",new[]{"HTTP 429: kaynak kotası doldu"});
      Check(Convert.ToInt32(Dict(Call("LocalBooks",path,""))["count"])==3,"Metadata saved; bare title/author seed skipped");
    } else {
      var found=Items(Call("LookupCached",path,"9786256372030",Context("","tr"),false));Check(found.Length==1,"Offline ISBN cache hit after process restart");
      var item=(Dictionary<string,object>)found[0];Check((string)item["isbn"]=="9786256372030"&&(string)item["author"]=="Aslı Arslan","UTF-8 metadata roundtrip");Check(!item.ContainsKey("price")&&!item.ContainsKey("offers"),"Prices never persisted as metadata");
      var cached=Dict(Call("LookupCached",path,"Emare Maske",Context("","tr"),false));Check((bool)cached["fromCache"]&&(bool)cached["local"]&&((object[])cached["items"]).Length==2,"Offline title author language cache reuse keeps both editions separate");
      Check(Items(Call("LookupCached",path,product,Context("","tr"),false)).Length==1,"Direct product URL cache reuse");
      Check(((List<IDictionary<string,object>>)Call("LocalLookup",path,"9786256372047",Context("","tr"))).Count==1,"Different edition has independent key");
      Check(((List<IDictionary<string,object>>)Call("LocalLookup",path,"9786256372054",Context("","tr"))).Count==0,"English edition never reused for Turkish ISBN request");
      Check(((List<IDictionary<string,object>>)Call("LocalLookup",path,product,Context("9786256372047","tr"))).Count==0,"Direct URL cannot bypass requested edition");
      var wrongAuthor=Context("","tr");wrongAuthor["author"]="Başka Yazar";Check(((List<IDictionary<string,object>>)Call("LocalLookup",path,"Emare Maske",wrongAuthor)).Count==0,"Wrong author rejected");
      // A second source is retained independently; title/author never merge editions.
      var second=Book("9786256372030","tr","volume-id");second["source"]="Google Books";second.Remove("productUrl");second["sourceUrl"]="https://books.google.com/books?id=volume-id";Call("StoreMetadata",path,new[]{second});
      Check(Convert.ToInt32(Dict(Call("LocalBooks",path,""))["count"])==4,"Same ISBN from two sources retains provenance");
      Call("RecordDiagnostics",path,"books","https://user:password@example.com/book?token=secret",Enumerable.Range(0,230).Select(i=>"Hata "+i+" token=never-store-this https://user:password@example.com/book?key=private#fragment"));
      var diagnostics=Dict(Call("Diagnostics",path));string diagnosticJson=Json.Serialize(diagnostics);Check(((object[])diagnostics["entries"]).Length==200,"Diagnostics bounded to latest 200");Check(!diagnosticJson.Contains("never-store-this")&&!diagnosticJson.Contains("user:password")&&!diagnosticJson.Contains("key=private"),"Diagnostics remove credentials and URL query values");
      // Exercise authentication and public response on actual handler, not a mocked DB.
      AppDomain.CurrentDomain.SetData(".appPath",root+Path.DirectorySeparatorChar);AppDomain.CurrentDomain.SetData(".appVPath","/");
      string content="{\"site\":{},\"texts\":{},\"about\":{},\"books\":[{\"title\":\"No ISBN\",\"author\":\"Yazar\"}],\"series\":[],\"journal\":[],\"ritual\":[],\"photos\":[],\"quotes\":[]}";File.WriteAllText(Path.Combine(root,"content.json"),content,new UTF8Encoding(false));
      Request(root,"action=diagnostics","GET",false,null,null,401);Request(root,"action=local-books","GET",false,null,null,401);Request(root,"action=diagnostics-clear","POST",false,"{}",null,401);
      var prices=Request(root,"action=prices&book=no-isbn","GET",false,null,null,200);Check(!prices.ContainsKey("warnings")&&!prices.ContainsKey("reasons")&&!prices.ContainsKey("error")&&prices.ContainsKey("offers")&&prices.ContainsKey("searches"),"Public prices contain no internal warnings or errors");
      var admin=Request(root,"action=diagnostics","GET",true,null,null,200);Check(Json.Serialize(admin).Contains("ISBN-13/ISBN-10"),"Anonymous price warnings visible only in persistent admin diagnostics");
      var lookup=Request(root,"action=books&q=9786256372030&lang=tr","GET",true,null,null,200);Check((bool)lookup["fromCache"]&&((object[])lookup["items"]).Length==2,"Authenticated actual books route reuses DB offline");
      Request(root,"action=diagnostics-clear","GET",true,null,null,405);Request(root,"action=diagnostics-clear","POST",true,"{}","https://evil.example",403);Request(root,"action=diagnostics-clear","POST",true,"{}",null,200);
      Check(((object[])Dict(Call("Diagnostics",path))["entries"]).Length==0&&Convert.ToInt32(Dict(Call("LocalBooks",path,""))["count"])==4,"Clearing diagnostics preserves collected books");
      var saved=Json.Deserialize<Dictionary<string,object>>(content);saved["books"]=new[]{Book("9789750738609","tr","manual-edition")};Request(root,"action=save","POST",true,Json.Serialize(saved),null,200);Check(File.Exists(Path.Combine(root,"App_Data/content.bak.json")),"Content backup preserved");Check(((List<IDictionary<string,object>>)Call("LocalLookup",path,"9789750738609",Context("","tr"))).Count==1,"Manual save persisted useful metadata");
      string migration=Path.Combine(root,"migration");Directory.CreateDirectory(migration);File.WriteAllText(Path.Combine(migration,"content.json"),Json.Serialize(saved),new UTF8Encoding(false));
      var migrated=Request(migration,"action=books&q=9789750738609&lang=tr","GET",true,null,null,200);Check((bool)migrated["fromCache"]&&((object[])migrated["items"]).Length==1,"Existing useful content migrated before first lookup without network");
      // Existing collected DB information takes precedence over older content.json.
      var oldBook=Book("9789750738609","tr","manual-edition");oldBook["publisher"]="Old Publisher";saved["books"]=new[]{oldBook};File.WriteAllText(Path.Combine(migration,"content.json"),Json.Serialize(saved),new UTF8Encoding(false));
      var migratedAgain=Request(migration,"action=books&q=9789750738609&lang=tr","GET",true,null,null,200);Check((string)((Dictionary<string,object>)((object[])migratedAgain["items"])[0])["publisher"]=="Test Yayınevi","Migration does not overwrite populated database with older content");
      var manualNoIsbn=new Dictionary<string,object>{{"title","Geçmiş Kitap"},{"author","Türk Yazar"},{"publisher","Yerel Yayınevi"},{"desc","Önceden toplanmış açıklama"}};Call("StoreMetadata",path,new[]{manualNoIsbn});
      Check(((List<IDictionary<string,object>>)Call("LocalLookup",path,"Geçmiş Kitap",new Dictionary<string,object>{{"title","Geçmiş Kitap"},{"language","tr"}})).Count==1,"Useful manual metadata without ISBN remains reusable");
      string queryProduct="https://www.kitapyurdu.com/index.php?route=product/product&product_id=123&s_token=private-token";var queryBook=Book("","tr",queryProduct);Call("StoreMetadata",path,new[]{queryBook});
      var queryMatch=(List<IDictionary<string,object>>)Call("LocalLookup",path,"https://kitapyurdu.com/index.php?product_id=123&route=product%2Fproduct",Context("","tr"));
      Check(queryMatch.Count==1&&!Json.Serialize(queryMatch).Contains("private-token"),"Product query IDs retained, tracking secrets removed, www/order canonicalized");
      Check(((List<IDictionary<string,object>>)Call("LocalLookup",path,"https://www.kitapyurdu.com/index.php?route=product/product&product_id=456",Context("","tr"))).Count==0,"Same URL path with different product ID cannot reuse another edition");
      Check((string)Call("SafeSourceUrl","https://user:pass@www.kitapyurdu.com/book?api_key=secret")=="","Credential-bearing source URL never persisted");
      string badDatabase=Path.Combine(root,"database-is-directory");Directory.CreateDirectory(badDatabase);bool readFailed=false;try{Call("LocalLookup",badDatabase,"9786256372030",Context("","tr"));}catch{readFailed=true;}Check(readFailed,"Actual DB read failure detected");
      var notSaved=Dict(Call("CompleteLookup",badDatabase,"Emare Maske",new[]{Book("9786256372030","tr",product)},new[]{"Yerel veritabanı okunamadı"}));Check(((object[])notSaved["items"]).Length==1&&((object[])notSaved["warnings"]).Length==2&&Json.Serialize(notSaved["warnings"]).Contains("Modify"),"Remote metadata retained and explicit admin warning returned when DB read/write fails");
      File.WriteAllText(Path.Combine(root,"App_Data/content.json"),"{broken");var failed=Request(root,"action=content","GET",false,null,null,502);Check(!Json.Serialize(failed).Contains("Json")&&!Json.Serialize(failed).Contains("IIS")&&Json.Serialize(failed).Contains("biraz sonra"),"Unexpected public content failure uses friendly generic message");
    }
    Console.WriteLine("PASS: IIS database "+phase+" checks ("+count+").");
  }
}
