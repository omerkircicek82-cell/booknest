using System;

namespace MilyonHavuc.Core
{
    public sealed class Achievement
    {
        public readonly string Id,Name,Description;
        public readonly int Target;
        readonly Func<Campaign,int> read;
        public Achievement(string id,string name,string description,int target,Func<Campaign,int> read)
        {Id=id;Name=name;Description=description;Target=target;this.read=read;}
        public int Progress(Campaign state){return Math.Min(Target,Math.Max(0,read(state)));}
        public bool Unlocked(Campaign state){return Progress(state)>=Target;}
    }
    public static class FarmJournal
    {
        // All counters are monotonic, so achievements survive ordinary save/load without a new save schema.
        public static readonly Achievement[] Achievements={
            new Achievement("root","İlk kök","İlk havucunu kendi elinle sök.",1,s=>s.HandTotal),
            new Achievement("income","İlk kazanç","İlk havucu öğütücüden geçir.",1,s=>s.Processed),
            new Achievement("bucket","Daha büyük hayaller","Küçük Kova satın al.",1,s=>s.Has("bucket_small")?1:0),
            new Achievement("hoe","Toprağın ustası","El Kazması satın al.",1,s=>s.Has("hoe")?1:0),
            new Achievement("thousand","Bin kök geride","1.000 havuç işle.",1000,s=>s.Processed),
            new Achievement("robot","Yeni iş arkadaşın","İlk toplama robotunu satın al.",1,s=>s.Bots.Count),
            new Achievement("parcel","Çitin ötesinde","İlk parseli tamamen temizle.",1,s=>s.Remaining[0]==0?1:0),
            new Achievement("mobile","Tesis yola çıktı","Mobil Öğütücü satın al.",1,s=>s.Has("mobile")?1:0),
            new Achievement("tractor","Direksiyon sende","Sıra Traktörü satın al.",1,s=>s.Has("tractor")?1:0),
            new Achievement("fleet","Bir ekip meselesi","Toplam sekiz toplama robotuna sahip ol.",8,s=>s.Bots.Count),
            new Achievement("half","Yolun yarısı","Kampanyanın yarısını işle.",1,s=>s.Processed>=(s.Total+1)/2?1:0),
            new Achievement("finish","Son köke kadar","Kampanyadaki bütün havuçları işle.",1,s=>s.Won?1:0)
        };
        public static string NextGoal(Campaign s)
        {
            if(s.Won)return "Kampanya tamamlandı. Başarımlarını ve üretim raporunu incele.";
            if(s.Ground==0)return "Son teslimat: çanta, araç ve botlardaki havuçları öğütücüye ulaştır.";
            if(s.HandTotal==0)return "İlk kökü sök: havuca bak ve sol tuşu basılı tut.";
            if(s.Processed==0)return s.Bag>0?"İlk kazanç: arkandaki öğütücüye yaklaş ve E ile dök.":"Öğütücünün ilk havucu işlemesini bekle.";
            if(s.Bag>=s.BagCapacity)return "Çantan doldu. Öğütücüye dön; E ile yer aç.";
            if(!s.Has("bucket_small"))return "İlk yatırım: 18 ₵ biriktir ve Dükkân → Taşıma bölümünden Küçük Kova al.";
            if(!s.Has("hoe"))return "Daha hızlı hasat: 35 ₵ ile El Kazması al. 2 tuşuyla kullan.";
            if(s.Bots.Count==0)return s.Processed<450?"Otomasyona hazırlan: 450 havuç işle; Fidebot kilidi açılsın.":"İlk iş arkadaşın: 550 ₵ ile Fidebot al; hasat ve teslimatı o üstlensin.";
            if(!s.Has("mobile"))return "Tesisini büyüt: 2.400 havuç işle ve 3.300 ₵ ile Mobil Öğütücü al.";
            if(!s.Has("belt"))return "Teslimat ağı: 9.000 havuç işle ve 11.000 ₵ ile Taşıma Bandı al.";
            return "Parsel "+(s.ActiveParcel+1)+": son kökleri temizle. Üretim raporundan darboğazını bul.";
        }
    }
    public sealed class ProductionMonitor
    {
        const int Capacity=240;
        readonly int[] processed=new int[Capacity];
        readonly long[] earned=new long[Capacity];
        int index,count,totalProcessed,lastProcessed;
        long totalEarned,lastEarned;
        public ProductionMonitor(Campaign state){lastProcessed=state.Processed;lastEarned=state.Earned;}
        public double WindowSeconds {get{return count*.25;}}
        public double Rate {get{return count==0?0:totalProcessed/WindowSeconds;}}
        public double IncomePerMinute {get{return count==0?0:totalEarned/100.0/WindowSeconds*60;}}
        public void Sample(Campaign state)
        {
            if(state.Processed<lastProcessed||state.Earned<lastEarned)throw new InvalidOperationException("Yeni kampanya için yeni üretim izleyicisi oluştur.");
            totalProcessed-=processed[index];totalEarned-=earned[index];
            processed[index]=state.Processed-lastProcessed;earned[index]=state.Earned-lastEarned;
            totalProcessed+=processed[index];totalEarned+=earned[index];lastProcessed=state.Processed;lastEarned=state.Earned;
            index=(index+1)%Capacity;count=Math.Min(Capacity,count+1);
        }
        public static string Diagnosis(Campaign s)
        {
            if(s.Won)return "Üretim tamamlandı.";
            if(s.Ground==0)return "Son yükler: çanta "+s.Bag+", araç "+s.Vehicle+", botlar "+BotLoads(s)+", hazne "+s.Hopper+".";
            foreach(var bot in s.Bots)if(bot.Status=="Hazne dolu")return "Darboğaz: teslimat kuyruğu. Öğütme hızını veya hazneyi yükselt.";
            if(s.Hopper>=s.HopperCapacity*.9)return "Hazne dolmaya yakın. Daha hızlı motor veya Öğütme Ustalığı düşün.";
            if(s.Hopper==0)return "Öğütücü boşta. Daha sık teslim et veya toplama filonu güçlendir.";
            return "Hat çalışıyor. Hasat ve teslimat hızını üretim kapasitesiyle karşılaştır.";
        }
        static int BotLoads(Campaign s){int n=0;foreach(var b in s.Bots)n+=b.Load;return n;}
    }
}
