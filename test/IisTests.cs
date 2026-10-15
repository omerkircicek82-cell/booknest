// Mono veya .NET Framework C# derleyicisi ile save.ashx gövdesine karşı çalıştırılır.
using System;
using System.Reflection;
using System.Web.Script.Serialization;
class IisTests {
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
    Console.WriteLine("PASS: IIS C# bileşen testleri ("+count+").");
  }
}
