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
    Check(Call(api,"Price",prefix.Replace("129.90","1.234,56"),"9789750738609")==null,"Bozuk fiyat");
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
    Check((string)prices["scope"]=="Tan\u0131ml\u0131 sat\u0131c\u0131 ba\u011flant\u0131lar\u0131nda ayn\u0131 ISBN i\u00e7in do\u011frulanabilen \u00fcr\u00fcn fiyatlar\u0131. Kargo dahil de\u011fildir.","Fiyat kapsam\u0131 T\u00fcrk\u00e7e karakterleri");
    var searches=(object[])prices["searches"];
    Check((string)((Dictionary<string,object>)searches[3])["store"]=="\u0130defix","Sat\u0131c\u0131 T\u00fcrk\u00e7e karakterleri");
    var worker=new ResponseWorker();var responseContext=new HttpContext(worker);
    ((IHttpHandler)api).ProcessRequest(responseContext);responseContext.Response.Flush();
    Check(responseContext.Response.StatusCode==401,"Kimlik do\u011frulama yan\u0131t\u0131");
    Check(responseContext.Response.ContentEncoding.CodePage==65001&&responseContext.Response.Charset=="utf-8","Yan\u0131t UTF-8 kodlamas\u0131");
    var response=json.Deserialize<Dictionary<string,object>>(new UTF8Encoding(false,true).GetString(worker.Body.ToArray()));
    Check((string)response["msg"]=="Giri\u015f gerekli.","Ger\u00e7ek yan\u0131t baytlar\u0131nda T\u00fcrk\u00e7e karakterler");
    Console.WriteLine("PASS: IIS C# bileşen testleri ("+count+").");
  }
}
