using System;
using System.IO;
using System.Linq;
using System.Text.Json;
using MilyonHavuc.Core;
static class Program
{
    static int passed;
    static void Check(bool ok,string message){if(!ok)throw new Exception(message);}
    static void Test(string name,Action action){action();passed++;Console.WriteLine("PASS "+name);}
    static void Tick(Campaign s,int n){for(int i=0;i<n;i++)s.Step();}
    static void Main(string[] args)
    {
        if(args.Contains("--simulate")){Simulation.Run();return;}
        Test("Tam bir milyon hücre ve 125.000 bayt",()=>{var s=Campaign.New();s.Validate();Check(s.Ground==1000000&&s.Harvested.Length==125000&&s.BagCapacity==6&&s.HopperCapacity==24,"Yeni oyun");});
        Test("Çift hasat, dolu çanta, hasatta ödül yok",()=>{var s=Campaign.New();Check(s.Harvest(0)==1&&s.Harvest(0)==0,"Çift hasat");for(int i=1;i<6;i++)s.Harvest(i);Check(s.Harvest(7,24)==0&&s.Bag==6&&s.Xp==0&&s.Money==0,"Dolu çanta");s.Validate();});
        Test("Son boş yer, alan hasadı sınırı",()=>{var s=Campaign.New();for(int i=0;i<5;i++)s.Harvest(i);Check(s.Harvest(10,24)==1&&s.Bag==6,"Son boş yer");s.Validate();});
        Test("Kısmi boşaltma ve yalnızca öğütmeden ödül",()=>{var s=Campaign.New();for(int i=0;i<22;i++){s.Harvest(i);s.Deposit();}for(int i=22;i<28;i++)s.Harvest(i);Check(s.Deposit()==2&&s.Bag==4&&s.Hopper==24&&s.Money==0,"Kısmi dökme");s.Step();Check(s.Processed==1&&s.Xp==1&&s.Money==100,"Öğütme");s.Validate();});
        Test("Kilitli veya pahalı alım durumu değiştirmez",()=>{var s=Campaign.New();Check(!s.Buy("hoe")&&!s.Buy("factory")&&s.Money==0&&s.Owned.Count==1,"Alım");});
        Test("XP eşikleri tekrar puan vermez",()=>{var s=Campaign.New(400,100);s.Owned.Add("factory");while(s.Ground>0){s.Harvest(s.NearestLive(s.ActiveParcel),6);s.Deposit();}Tick(s,10);Check(s.Processed==400&&s.Level==5&&s.Points==4,"XP");s.Step();Check(s.Points==4,"Çift puan");s.Validate();});
        Test("Yüksek kademeden sonra alt alım düşürmez",()=>{var s=Campaign.New();s.Owned.AddRange(new[]{"factory","bulk_bag"});Check(s.GrindRate==460&&s.BagCapacity==4000,"Üst ekipman");s.Owned.AddRange(new[]{"hopper","bucket_small"});Check(s.GrindRate==460&&s.BagCapacity==4000,"Alt ekipman");});
        Test("Beceri sıfırlama kapasite üstü yükü silmez",()=>{var s=Campaign.New(100,100);for(int i=0;i<20;i++){s.Harvest(i);s.Deposit();s.Step();}s.Owned.Add("bucket_small");Check(s.Learn(2),"Beceri");for(int i=20;i<38;i++)s.Harvest(i);Check(s.Bag==18,"Büyüyen çanta");s.ResetSkills();Check(s.Bag==18&&s.BagCapacity==16&&s.Harvest(40)==0,"Yük korunmalı");s.Validate();});
        Test("Yarım hasat, menzil ve değişen hedef",()=>{var s=Campaign.New();var a=new HarvestAction();Check(a.Advance(s,0,true,true,.3)==0,"Erken hasat");a.Advance(s,0,true,false,.4);Check(s.Bag==0&&a.Progress==0,"Menzil iptali");a.Advance(s,0,true,true,.3);Check(a.Advance(s,1,true,true,.3)==0,"Hedef değişimi");Check(a.Advance(s,1,true,true,.3)==1&&s.IsHarvested(1)&&!s.IsHarvested(0),"Tam hasat");s.Validate();});
        Test("Dolu haznede bot bekler ve yük kaybetmez",()=>{var s=Campaign.New(1000,100);s.Bots.Add(new Robot("bot_row",0,0));bool waited=false;for(int i=0;i<3000&&!s.Won;i++){s.Step();if(s.Bots[0].Status=="Hazne dolu"){waited=true;Check(s.Bots[0].Load>0,"Bekleyen yük");}if(i%40==0)s.Validate();}Check(waited&&s.Won,"Geri basınç ve tamamlama");s.Validate();});
        Test("Parsel kilidi toprak boşalınca açılır, final işleme bekler",()=>{var s=Campaign.New(8,4);Check(s.Harvest(4)==0,"Kilit");for(int i=0;i<4;i++)s.Harvest(i);Check(s.ActiveParcel==1&&s.Processed==0,"Parsel");s.Deposit();for(int i=4;i<8;i++)s.Harvest(i);Check(s.Ground==0&&!s.Won,"Erken zafer");s.Deposit();Tick(s,8);Check(s.Won&&s.Processed==8,"Zafer");s.Validate();});
        Test("Oyuncu ve bot çakışması, dolu haznede yük korunur",()=>{var s=Campaign.New(100,100);var b=new Robot("bot_seed",0,0);s.Bots.Add(b);s.Harvest(0);Tick(s,8);Check(s.BotTotal>0,"Bot");s.Validate();});
        Test("Robot geri basıncı ve pasifleştirme",()=>{var s=Campaign.New(200,100);s.Bots.Add(new Robot("bot_row",0,0));for(int i=0;i<160;i++)s.Step();s.ToggleBot(0);Tick(s,800);Check(s.Bots[0].Load==0&&s.Bots[0].Status=="Garajda","Garaj teslimi");s.Validate();});
        Test("Robot kopya fiyatları ve 8 yuva",()=>{var s=Campaign.New();var p=Catalog.Get("bot_row");Check(s.Price(p)==4200,"Fiyat1");s.Bots.Add(new Robot("bot_row",0,0));Check(s.Price(p)==5670,"Fiyat2");});
        Test("Boşta kredi biriktirmez",()=>{var s=Campaign.New();Tick(s,100);s.Harvest(0);s.Deposit();s.Step();Check(s.Processed==1,"Boşta kredi");});
        Test("Kayıt, tekrar yükleme ve bozuk ana kayıt yedeği",()=>{
            string dir=Path.Combine(Path.GetTempPath(),"milyon-tests-"+Guid.NewGuid());Directory.CreateDirectory(dir);
            try{var opts=new JsonSerializerOptions{IncludeFields=true,IgnoreReadOnlyProperties=true};var store=new SaveStore(Path.Combine(dir,"save.json"),s=>JsonSerializer.Serialize(s,opts),s=>JsonSerializer.Deserialize<Campaign>(s,opts));var s=Campaign.New();s.Harvest(0);s.Deposit();s.Step();store.Save(s);store.Save(s);var loaded=store.Load(out _);Check(loaded.Money==100&&loaded.IsHarvested(0),"Yükle");loaded.Step();Check(loaded.Money==100,"Çift ödül");File.WriteAllText(Path.Combine(dir,"save.json"),"broken");loaded=store.Load(out bool backup);Check(backup&&loaded.Processed==1,"Yedek");File.WriteAllText(Path.Combine(dir,"save.json.bak"),"broken");bool error=false;try{store.Load(out _);}catch(InvalidDataException){error=true;}Check(error,"Bozuk kayıt sessiz silinmemeli");}finally{Directory.Delete(dir,true);}
        });
        Test("Küçük dünya otomasyonla uçtan uca tamamlanır",()=>{var s=Campaign.New(400,100);s.Bots.Add(new Robot("bot_row",0,0));for(int i=0;i<10000&&!s.Won;i++){s.Step();s.Validate();}Check(s.Won&&s.Processed==400&&s.Money==40000,"Tam oturum");});
        Test("Başarımlar ödül veya ürün yaratmaz",()=>{var s=Campaign.New();Check(!FarmJournal.Achievements.Any(a=>a.Unlocked(s)),"Başlangıç rozetleri");s.Harvest(0);Check(FarmJournal.Achievements.Single(a=>a.Id=="root").Unlocked(s),"İlk kök");Check(s.Money==0&&s.Xp==0,"Rozet ödülü olmamalı");s.Validate();});
        Test("Son kök rozeti işleme tamamlanana kadar açılmaz",()=>{var s=Campaign.New(4,4);s.Harvest(0,4);Check(!FarmJournal.Achievements.Single(a=>a.Id=="finish").Unlocked(s),"Erken final rozeti");s.Deposit();Tick(s,4);Check(FarmJournal.Achievements.Single(a=>a.Id=="finish").Unlocked(s),"Final rozeti");s.Validate();});
        Test("Hedef rehberi ilk hasat ve teslimatı izler",()=>{var s=Campaign.New();Check(FarmJournal.NextGoal(s).Contains("İlk kökü"),"İlk hedef");s.Harvest(0);Check(FarmJournal.NextGoal(s).Contains("E ile dök"),"Teslim hedefi");s.Deposit();s.Step();Check(FarmJournal.NextGoal(s).Contains("Küçük Kova"),"Yatırım hedefi");});
        Test("Üretim raporu yeniden yüklenen ödülü saymaz",()=>{var s=Campaign.New();s.Harvest(0);s.Deposit();s.Step();var m=new ProductionMonitor(s);m.Sample(s);Check(m.Rate==0&&m.IncomePerMinute==0,"Eski kazanç");s.Harvest(1);s.Deposit();s.Step();m.Sample(s);Check(m.Rate==2&&m.IncomePerMinute==120,"Örnek penceresi");});
        Test("Üretim penceresi 60 saniyeyle sınırlı",()=>{var s=Campaign.New();var m=new ProductionMonitor(s);s.Harvest(0);s.Deposit();s.Step();m.Sample(s);for(int i=0;i<240;i++)m.Sample(s);Check(m.WindowSeconds==60&&m.Rate==0&&m.IncomePerMinute==0,"Eski örnek düşmeli");});
        Test("Darboğaz teşhisi boş ve dolu hazneyi ayırır",()=>{var s=Campaign.New();Check(ProductionMonitor.Diagnosis(s).Contains("boşta"),"Boş makine");for(int i=0;i<24;i++){s.Harvest(i);s.Deposit();}Check(ProductionMonitor.Diagnosis(s).Contains("dolmaya"),"Dolu makine");s.Validate();});
        Console.WriteLine($"{passed} / {passed} test başarılı");
    }
}
