using System;
using System.Collections.Generic;
using System.Linq;

namespace MilyonHavuc.Core
{
    [Serializable] public sealed class Product
    {
        public string Id, Name, Category, Description, Requires;
        public int Price, Unlock, Amount, Capacity, Max;
        public double Seconds, Rate;
        public Product(string id, string name, string category, int price, int unlock, string description,
            int amount = 0, double seconds = 0, int capacity = 0, double rate = 0, int max = 1, string requires = "")
        { Id=id; Name=name; Category=category; Price=price; Unlock=unlock; Description=description;
          Amount=amount; Seconds=seconds; Capacity=capacity; Rate=rate; Max=max; Requires=requires; }
    }
    public static class Catalog
    {
        public const string Version = "0.1";
        public static readonly int[] Xp = {20,70,160,300,550,900,1500,2500,4000,6500,10000,16000,24000,36000,52000,72000,100000,135000,175000,225000,285000,350000,425000,505000,585000,665000,745000,820000,890000,950000};
        public static readonly string[] Branches={"reach","tempo","carry","market","grind","robotics","logistics"};
        public static readonly string[] BranchNames={"Geniş Kavrama","Seri Hasat","Taşıma Ustalığı","Pazar Bilgisi","Öğütme Ustalığı","Robot Bakımı","Hat Optimizasyonu"};
        public static readonly Product[] Products = {
            new Product("hand","El","Alet",0,0,"1 havuç · 0,55 sn",1,.55),
            new Product("hoe","El Kazması","Alet",35,0,"3 havuç · 0,70 sn",3,.70),
            new Product("rake","Çift Dişli Çapa","Alet",160,120,"6 havuç · 0,78 sn",6,.78),
            new Product("row_lifter","Sıra Söken","Alet",640,550,"12 havuç · 0,92 sn",12,.92),
            new Product("power_lifter","Akülü Hasatçı","Alet",2800,2000,"24 havuç · 0,88 sn",24,.88),
            new Product("wide_head","Geniş Ağız","Alet",9500,8000,"48 havuç · 1,05 sn",48,1.05,requires:"power_lifter"),
            new Product("root_vac","Kök Vakumu","Alet",26000,22000,"90 havuç · 1,10 sn",90,1.10),
            new Product("tractor","Sıra Traktörü","Araç",55000,55000,"110 havuç/s · 1.200 kasa",capacity:1200,rate:110),
            new Product("tractor_head","Geniş Traktör Kafası","Araç",105000,140000,"155 havuç/s · 3.200 kasa",capacity:3200,rate:155,requires:"tractor"),
            new Product("scanner","Kök Tarayıcı","Destek",4500,5000,"Kalan köklere yön gösterir"),
            new Product("bucket_small","Küçük Kova","Taşıma",18,0,"Çanta 16",capacity:16),
            new Product("bucket_large","Galvaniz Kova","Taşıma",80,55,"Çanta 40",capacity:40),
            new Product("basket","Sırt Sepeti","Taşıma",300,220,"Çanta 100",capacity:100),
            new Product("cart","El Arabası","Taşıma",1100,800,"Çanta 250",capacity:250),
            new Product("trailer","Çekmeli Kasa","Taşıma",4800,3500,"Çanta 650",capacity:650),
            new Product("belt_pack","Konveyör Çantası","Taşıma",16000,13000,"Çanta 1.800",capacity:1800),
            new Product("bulk_bag","Endüstriyel Kasa","Taşıma",42000,38000,"Çanta 4.000",capacity:4000),
            new Product("hopper","Hazne Genişletme","Öğütme",130,100,"Hazne 120 · 10/s",capacity:120,rate:10),
            new Product("motor","Güçlü Motor","Öğütme",780,650,"Hazne 420 · 28/s",capacity:420,rate:28),
            new Product("mobile","Mobil Öğütücü","Öğütme",3300,2400,"Hazne 1.600 · 60/s · servis yuvası",capacity:1600,rate:60),
            new Product("belt","Taşıma Bandı","Öğütme",11000,9000,"Hazne 4.500 · 130/s · ikinci giriş",capacity:4500,rate:130),
            new Product("dual_line","Çift Hat","Öğütme",38000,32000,"Hazne 12.000 · 230/s",capacity:12000,rate:230),
            new Product("industrial","Endüstriyel Öğütücü","Öğütme",100000,90000,"Hazne 30.000 · 340/s",capacity:30000,rate:340),
            new Product("factory","Fabrika Hattı","Öğütme",220000,240000,"Hazne 80.000 · 460/s",capacity:80000,rate:460),
            new Product("bot_seed","Fidebot","Filo",550,450,"1,8/s · yük 30",capacity:30,rate:1.8,max:3),
            new Product("bot_row","Sıra Robotu","Filo",4200,3200,"8/s · yük 140",capacity:140,rate:8,max:4),
            new Product("bot_dig","Kazıcı Bot","Filo",16000,14000,"20/s · yük 380",capacity:380,rate:20,max:4),
            new Product("drone","Kargo Drone’u","Destek",24000,20000,"Teslimat gecikmesi −%35"),
            new Product("bot_auto","Otonom Hasatçı","Filo",55000,65000,"48/s · yük 850",capacity:850,rate:48,max:4),
            new Product("fleet_console","Filo Kumandası","Destek",18000,16000,"Gelişmiş filo önceliği ve uyarılar"),
            new Product("bot_heavy","Ağır Hasatçı","Filo",135000,190000,"85/s · yük 1.800",capacity:1800,rate:85,max:3),
            new Product("route_ai","Akıllı Rota","Destek",62000,80000,"Teslimat gecikmesi −%20; drone ile −%55"),
            new Product("sweep","Son Kök Protokolü","Destek",60000,450000,"Son 100 kökte en yakın hedef önceliği")
        };
        public static Product Get(string id) { return Products.FirstOrDefault(x=>x.Id==id); }
    }
}
