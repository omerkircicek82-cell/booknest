// Mono veya .NET Framework C# derleyicisi ile save.ashx gövdesine karşı çalıştırılır.
using System;
using System.Collections.Generic;
using System.IO;
using System.Reflection;
using System.Text;
using System.Web;
using System.Web.Hosting;
using System.Web.Script.Serialization;
class IisTests {
  class ResponseWorker : SimpleWorkerRequest {
    public readonly MemoryStream Body=new MemoryStream();
    public ResponseWorker():base("/",Path.GetTempPath(),"save.ashx","action=books",TextWriter.Null){}
    public override void SendResponseFromMemory(byte[] data,int length){Body.Write(data,0,length);}
  }
  static int count;
  static void Check(bool value,string message){if(!value)throw new Exception(message);count++;}
  static object Call(object api,string name,params object[] args){return api.GetType().GetMethod(name,BindingFlags.Instance|BindingFlags.NonPublic).Invoke(api,args);}
  public static void Main(string[] args){
    var api=Activator.CreateInstance(Assembly.LoadFrom(args[0]).GetType("BookNestApi"));
    string prefix="<script type=\"application/ld+json\">{\"@type\":\"Product\",\"gtin13\":\"9789750738609\",\"offers\":{\"@type\":\"Offer\",\"price\":\"129.90\",\"priceCurrency\":\"TRY\",\"availability\":\"https://schema.org/InStock\"}}</script>";
    Check(Convert.ToDecimal(Call(api,"Price",prefix,"9789750738609"))==129.9m,"TRY fiyatı");
    Check(Call(api,"Price",prefix,"9789750738616")==null,"Farklı baskı");
    Check(Call(api,"Price",prefix.Replace("InStock","OutOfStock"),"9789750738609")==null,"Stoksuz ürün");
    Check(Call(api,"Price",prefix.Replace("TRY","EUR"),"9789750738609")==null,"Başka para birimi");
    Check(Call(api,"Price",prefix.Replace("129.90","12,3,4"),"9789750738609")==null,"Bozuk fiyat");
    Check((int)Call(api,"Retailer","https://www.dr.com.tr/kitap/test")==0,"Satıcı doğrulama");
    Check((int)Call(api,"Retailer","https://www.dr.com.tr.attacker.org/kitap/test")==-1,"Sahte alan adı");
    Check((int)Call(api,"Retailer","https://127.0.0.1/test")==-1,"Yerel ağ");
    Check((string)Call(api,"Slug","İçinde Bir Sen: Engerek")=="icinde-bir-sen-engerek","Türkçe slug");
    var json=new JavaScriptSerializer();var d=json.DeserializeObject(System.IO.File.ReadAllText(args[1]));Call(api,"Validate",d);count++;
    // No product URLs: exercise the real price response without external requests.
    // Escapes keep the expected strings independent of the compiler's source codepage.
    var context=new HttpContext(new HttpRequest("","http://localhost/save.ashx",""),new HttpResponse(new StringWriter()));
    var book=new Dictionary<string,object>{{"title","Test"},{"priceUrls",new object[0]}};
    var prices=(Dictionary<string,object>)json.DeserializeObject(json.Serialize(Call(api,"Prices",context,book)));
    Check((string)prices["scope"]=="Ayn\u0131 ISBN i\u00e7in ma\u011faza sayfalar\u0131nda g\u00f6zlenen TRY \u00fcr\u00fcn fiyatlar\u0131. Stok bilgisi belirtilmeyen teklifler i\u015faretlenir. Kargo dahil de\u011fildir.","Fiyat kapsam\u0131 T\u00fcrk\u00e7e karakterleri");
    var searches=(object[])prices["searches"];
    Check((string)((Dictionary<string,object>)searches[3])["store"]=="\u0130defix","Sat\u0131c\u0131 T\u00fcrk\u00e7e karakterleri");
    var worker=new ResponseWorker();var responseContext=new HttpContext(worker);
    ((IHttpHandler)api).ProcessRequest(responseContext);responseContext.Response.Flush();
    Check(responseContext.Response.StatusCode==401,"Kimlik do\u011frulama yan\u0131t\u0131");
    Check(responseContext.Response.ContentEncoding.CodePage==65001&&responseContext.Response.Charset=="utf-8","Yan\u0131t UTF-8 kodlamas\u0131");
    var response=json.Deserialize<Dictionary<string,object>>(new UTF8Encoding(false,true).GetString(worker.Body.ToArray()));
    Check((string)response["msg"]=="Giri\u015f gerekli.","Ger\u00e7ek yan\u0131t baytlar\u0131nda T\u00fcrk\u00e7e karakterler");
    Check(Convert.ToDecimal(Call(api,"Price",prefix.Replace("129.90","1.234,56"),"9789750738609"))==1234.56m,"Yerel ondal\u0131k fiyat");
    string fixtureRoot=Path.Combine(Path.GetDirectoryName(Path.GetFullPath(args[1])),"test/fixtures");
    string carton=File.ReadAllText(Path.Combine(fixtureRoot,"captured-kitapyurdu-emare-karton.html"));
    string hardback=File.ReadAllText(Path.Combine(fixtureRoot,"captured-kitapyurdu-emare-ciltli.html"));
    Check(Convert.ToDecimal(Call(api,"Price",carton,"9786256372030"))==293.11m,"Ger\u00e7ek sayfa \u015femas\u0131 fiyat\u0131");
    Check(Call(api,"Price",hardback,"9786256372030")==null,"Di\u011fer bask\u0131 fiyat\u0131 reddedilir");
    var metadata=(IDictionary<string,object>)Call(api,"RetailMetadata",carton,"https://www.kitapyurdu.com/kitap/emare-maske-karton-kapak/750641.html","");
    Check((string)metadata["author"]=="Asl\u0131 Arslan"&&(string)metadata["pages"]=="736"&&(string)metadata["isbn"]=="9786256372030"&&(string)metadata["language"]=="tr","Product ve Book birle\u015fimi");
    var lookupContext=new Dictionary<string,object>{{"title","Emare Maske"},{"author","Asl\u0131 Arslan"},{"language","tr"}};
    var english=new Dictionary<string,object>{{"title","Emare Maske"},{"author","Asl\u0131 Arslan"},{"language","en"}};
    Check(!(bool)Call(api,"MatchesBook",english,lookupContext),"Varsay\u0131lan aramada \u0130ngilizce reddedilir");
    lookupContext["language"]="all";Check((bool)Call(api,"MatchesBook",english,lookupContext),"T\u00fcm diller a\u00e7\u0131k se\u00e7im");
    lookupContext["language"]="tr";var wrongAuthor=new Dictionary<string,object>{{"title","Emare Maske"},{"author","Ba\u015fka Yazar"},{"language","tr"}};Check(!(bool)Call(api,"MatchesBook",wrongAuthor,lookupContext),"Yanl\u0131\u015f yazar reddedilir");
    string links="<a href='https://www.kitapyurdu.com/kitap/emare-maske/1.html?s_token=remove'>Emare Maske</a><a href='https://127.0.0.1/private'>Emare Maske</a><a href='https://www.dr.com.tr/kitap/test'>Emare Maske</a>";
    var candidates=(List<string>)Call(api,"SearchCandidates",links,"https://www.kitapyurdu.com/index.php?route=product/list","Emare Maske");Check(candidates.Count==1&&candidates[0]=="https://www.kitapyurdu.com/kitap/emare-maske/1.html","G\u00fcvenli \u00fcr\u00fcn ke\u015ffi");
    Check(!(bool)Call(api,"AllowedUrl","https://127.0.0.1/private"),"Yerel a\u011f istekleri reddedilir");
    Check(Convert.ToDecimal(Call(api,"Price",prefix.Replace("https://schema.org/InStock",""),"9789750738609"))==129.9m,"Eksik stokla g\u00f6zlenen fiyat korunur");
    string unrelated="<link rel='canonical' href='https://www.kitapyurdu.com/kitap/baska/1.html'><script type='application/ld+json'>[{\"@type\":\"Product\",\"url\":\"https://www.kitapyurdu.com/kitap/baska/1.html\",\"gtin13\":\"9786256372047\",\"offers\":{\"price\":999,\"priceCurrency\":\"TRY\",\"availability\":\"InStock\"}},{\"@type\":\"Product\",\"url\":\"https://www.kitapyurdu.com/kitap/emare/2.html\",\"gtin13\":\"9786256372030\",\"offers\":{\"price\":1,\"priceCurrency\":\"TRY\",\"availability\":\"InStock\"}}]</script>";
    Check(Call(api,"Price",unrelated,"9786256372030")==null,"Ilgili urun fiyati ana urun sayilmaz");
    Console.WriteLine("PASS: IIS C# bileşen testleri ("+count+").");
  }
}
