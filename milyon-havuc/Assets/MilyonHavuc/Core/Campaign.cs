using System;
using System.Collections.Generic;
using System.Linq;

namespace MilyonHavuc.Core
{
    [Serializable] public sealed class Robot
    {
        public string ProductId, Status="Hasat";
        public bool Active=true;
        public int Load, Parcel, Cursor;
        public double Credit, Travel, Delivered;
        public double[] Deliveries=new double[240];
        public int Window;
        public Robot() { }
        public Robot(string id,int parcel,int cursor) {ProductId=id;Parcel=parcel;Cursor=cursor;}
        public double LastMinute { get {return Deliveries.Sum()/60;} }
    }
    [Serializable] public sealed class Campaign
    {
        public event Action<int> CellRemoved;
        public int Schema=1, Total=1000000, CellsPerParcel=10000, ActiveParcel, Bag, Vehicle, Hopper, Processed, Xp;
        public int HandTotal, BotTotal, TractorTotal, Seed=82, SelectedTool=0;
        public long Money, Earned;
        public double Seconds, GrindCredit, TractorCredit, HighestRate;
        public bool Won, Riding;
        public string CatalogVersion=Catalog.Version;
        public byte[] Harvested;
        public int[] Remaining;
        public List<string> Owned=new List<string>{"hand"};
        public int[] Skills=new int[7];
        public List<Robot> Bots=new List<Robot>();
        public float PlayerX=0,PlayerZ=-.7f,LookYaw=0,LookPitch=60;
        public Campaign() { }
        public static Campaign New(int total=1000000,int parcelSize=10000)
        {
            if(total<=0 || parcelSize<=0 || total%parcelSize!=0 || total>1000000) throw new ArgumentException("Geçersiz dünya");
            return new Campaign{Total=total,CellsPerParcel=parcelSize,Harvested=new byte[(total+7)/8],Remaining=Enumerable.Repeat(parcelSize,total/parcelSize).ToArray()};
        }
        public int Ground {get {return Remaining.Sum();}}
        public int Level {get {return 1+Catalog.Xp.Count(x=>Xp>=x);}}
        public int Points {get {int used=0;for(int i=0;i<7;i++)for(int j=1;j<=Skills[i];j++) used+=i==6?1:j;return Level-1-used;}}
        public bool Has(string id) {return Owned.Contains(id);}
        public int BagCapacity {get {return (int)Math.Floor(Math.Max(6,MaxValue("Taşıma",p=>p.Capacity))*new[]{1,1.15,1.30,1.50}[Skills[2]]);}}
        public int HopperCapacity {get {return (int)Math.Floor(Math.Max(24,MaxValue("Öğütme",p=>p.Capacity))*new[]{1,1.15,1.30,1.50}[Skills[6]]);}}
        public double GrindRate {get {return Math.Max(4,MaxValue("Öğütme",p=>p.Rate))*new[]{1,1.10,1.20,1.30}[Skills[4]];}}
        public int VehicleCapacity {get {return Has("tractor_head")?3200:1200;}}
        public Product Tool {get {var tools=Catalog.Products.Where(p=>p.Category=="Alet" && Has(p.Id)).ToArray();return SelectedTool==0?tools[0]:SelectedTool==1?tools.Where(p=>p.Amount<=12).Last():tools.Last();}}
        public int HarvestAmount {get {return Tool.Id=="hand"?1+Skills[0]:(int)Math.Floor(Tool.Amount*new[]{1,1.25,1.50,1.80}[Skills[0]]);}}
        public double HarvestTime {get {return Math.Max(.22,Tool.Seconds*new[]{1,.90,.80,.68}[Skills[1]]);}}
        public double Reach {get {return Tool.Id=="hand"?2:Tool.Amount<=6?2.5:Tool.Amount<=24?3.5:4.5;}}
        double MaxValue(string category,Func<Product,double> value) {return Catalog.Products.Where(p=>p.Category==category && Has(p.Id)).Select(value).DefaultIfEmpty(0).Max();}
        public bool IsHarvested(int cell) {return cell<0 || cell>=Total || (Harvested[cell>>3]&(1<<(cell&7)))!=0;}
        public bool CanHarvest(int cell) {return !Won && cell>=0 && cell<Total && cell/CellsPerParcel<=ActiveParcel && !IsHarvested(cell);}
        int Take(int cell) {if(!CanHarvest(cell))return 0;Harvested[cell>>3]|=(byte)(1<<(cell&7));int p=cell/CellsPerParcel;Remaining[p]--;CellRemoved?.Invoke(cell);while(ActiveParcel<Remaining.Length-1 && Remaining[ActiveParcel]==0)ActiveParcel++;return 1;}
        public int Harvest(int cell,int requested=1,bool vehicle=false)
        {
            if(!CanHarvest(cell) || requested<=0)return 0;
            int free=vehicle?VehicleCapacity-Vehicle:BagCapacity-Bag;
            int count=TakeArea(cell,Math.Min(requested,Math.Max(0,free)),vehicle?"tractor":Tool.Id);
            if(vehicle){Vehicle+=count;TractorTotal+=count;}else{Bag+=count;HandTotal+=count;}
            return count;
        }
        int TakeArea(int cell,int count,string shape)
        {
            if(count<=0 || !CanHarvest(cell))return 0;
            int parcel=cell/CellsPerParcel,start=parcel*CellsPerParcel,local=cell-start,width=(int)Math.Sqrt(CellsPerParcel);
            if(width*width!=CellsPerParcel)width=CellsPerParcel;
            var candidates=new List<int>();int radius=1;
            while(radius*radius*4<count*3)radius++;
            int rx=radius,ry=radius;
            if(shape=="rake"||shape=="row_lifter"||shape=="tractor"){rx=shape=="rake"?0:1;ry=Math.Max(radius,(int)Math.Ceiling(count/(double)(2*rx+1)));}
            for(int y=Math.Max(0,local/width-ry);y<=Math.Min((CellsPerParcel-1)/width,local/width+ry);y++)
                for(int x=Math.Max(0,local%width-rx);x<=Math.Min(width-1,local%width+rx);x++)
                {int id=start+y*width+x;if(id<start+CellsPerParcel && CanHarvest(id)) candidates.Add(id);}
            candidates.Sort((a,b)=>{int ax=(a-start)%width-local%width,ay=(a-start)/width-local/width,bx=(b-start)%width-local%width,by=(b-start)/width-local/width;int c=(ax*ax+ay*ay).CompareTo(bx*bx+by*by);return c!=0?c:a.CompareTo(b);});
            int taken=0;foreach(int id in candidates){if(taken>=count)break;taken+=Take(id);}return taken;
        }
        public int Deposit(bool vehicle=false)
        {
            int n=Math.Min(vehicle?Vehicle:Bag,Math.Max(0,HopperCapacity-Hopper));Hopper+=n;if(vehicle)Vehicle-=n;else Bag-=n;return n;
        }
        public string BuyReason(Product p)
        {
            if(p==null || p.Id=="hand")return "Başlangıç ekipmanı";
            int copies=Bots.Count(b=>b.ProductId==p.Id);
            if(p.Category=="Filo"?copies>=p.Max:Has(p.Id))return "Satın alındı";
            if(Processed<p.Unlock)return "Kilitli · "+p.Unlock.ToString("N0")+" havuç işle";
            if(p.Requires!=""&&!Has(p.Requires))return Catalog.Get(p.Requires).Name+" gerekli";
            long missing=Price(p)*100-Money;
            return missing>0?"Eksik "+(missing/100.0).ToString("N2")+" ₵":"";
        }
        public int Price(Product p) {return p.Category=="Filo"?(int)Math.Ceiling(p.Price*new[]{1,1.35,1.80,2.40}[Math.Min(3,Bots.Count(b=>b.ProductId==p.Id))]):p.Price;}
        public bool Buy(string id)
        {
            Product p=Catalog.Get(id);if(BuyReason(p)!="")return false;Money-=Price(p)*100L;
            if(p.Category=="Filo") {var b=new Robot(id,ActiveParcel,(Bots.Count*1237)%CellsPerParcel);b.Active=Bots.Count(x=>x.Active)<8;Bots.Add(b);}
            else Owned.Add(id);if(p.Category=="Alet")SelectedTool=p.Amount<=12?1:2;return true;
        }
        public bool Learn(int branch) {if(branch<0||branch>=7||Skills[branch]>=3||Points<(branch==6?1:Skills[branch]+1))return false;Skills[branch]++;return true;}
        public void ResetSkills(){Array.Clear(Skills,0,Skills.Length);}
        public bool ToggleBot(int index)
        {
            if(index<0||index>=Bots.Count)return false;Robot b=Bots[index];if(!b.Active&&Bots.Count(x=>x.Active)>=8)return false;
            b.Active=!b.Active;if(!b.Active&&b.Load>0&&b.Travel<=0)b.Travel=DeliveryDelay;return true;
        }
        public double DeliveryDelay {get{return 8*(Has("drone")?(Has("route_ai")?.45:.65):(Has("route_ai")?.8:1));}}
        public int NearestLive(int parcel,int local=0)
        {
            if(parcel<0||parcel>=Remaining.Length||Remaining[parcel]==0)return -1;
            for(int i=0;i<CellsPerParcel;i++){int id=parcel*CellsPerParcel+(local+i)%CellsPerParcel;if(CanHarvest(id))return id;}return -1;
        }
        public int NearestSpatial(int parcel,int local=0)
        {
            if(parcel<0||parcel>=Remaining.Length||Remaining[parcel]==0)return -1;
            int width=(int)Math.Sqrt(CellsPerParcel),best=-1,distance=int.MaxValue;
            for(int i=0;i<CellsPerParcel;i++){int id=parcel*CellsPerParcel+i;if(!CanHarvest(id))continue;int dx=i%width-local%width,dz=i/width-local/width,d=dx*dx+dz*dz;if(d<distance){distance=d;best=id;}}return best;
        }
        public void Step(double dt=.25)
        {
            if(Won)return;if(dt<=0||dt>.25)throw new ArgumentOutOfRangeException(nameof(dt));Seconds+=dt;
            foreach(Robot b in Bots) StepBot(b,dt);
            if(Hopper>0){GrindCredit+=GrindRate*dt;int n=Math.Min(Hopper,(int)GrindCredit);GrindCredit-=n;Hopper-=n;Processed+=n;Xp+=n;long gain=n*new[]{100,110,120,135}[Skills[3]];Money+=gain;Earned+=gain;if(Hopper==0)GrindCredit=0;}
            else GrindCredit=0;
            HighestRate=Math.Max(HighestRate,Bots.Sum(b=>b.LastMinute));
            if(Processed==Total)Won=true;
        }
        void StepBot(Robot b,double dt)
        {
            b.Window=(b.Window+1)%240;b.Deliveries[b.Window]=0;
            Product p=Catalog.Get(b.ProductId);
            if(b.Load>0&&(b.Travel>0 || b.Status=="Hazne dolu" || b.Load>=p.Capacity || !b.Active || b.Parcel!=ActiveParcel || Ground==0))
            {
                b.Status="Teslimata dönüyor";b.Credit=0;b.Travel=Math.Max(0,b.Travel-dt);
                if(b.Travel>0)return;
                int n=Math.Min(b.Load,Math.Max(0,HopperCapacity-Hopper));b.Load-=n;Hopper+=n;b.Delivered+=n;b.Deliveries[b.Window]=n;
                if(b.Load>0){b.Status="Hazne dolu";return;}b.Parcel=ActiveParcel;
            }
            if(!b.Active){b.Status="Garajda";b.Credit=0;return;}
            if(Ground==0){b.Status="Hedef arıyor";b.Credit=0;return;}
            b.Status="Hasat";b.Credit+=p.Rate*new[]{1,1.08,1.16,1.25}[Skills[5]]*dt;
            int nTake=Math.Min((int)b.Credit,p.Capacity-b.Load);b.Credit-=nTake;
            for(int i=0;i<nTake;i++)
            {
                int target=Has("sweep")&&Remaining[ActiveParcel]<=100?NearestSpatial(ActiveParcel,b.Cursor):NearestLive(ActiveParcel,b.Cursor);if(target<0){b.Credit=0;break;}
                b.Cursor=(target%CellsPerParcel+1)%CellsPerParcel;b.Load+=Take(target);BotTotal++;
            }
            if(b.Load>0&&(b.Load>=p.Capacity||b.Parcel!=ActiveParcel||Ground==0))b.Travel=DeliveryDelay;
        }
        public void Validate()
        {
            if(Schema!=1||CatalogVersion!=Catalog.Version||Total<=0||Total>1000000||CellsPerParcel<=0||Total%CellsPerParcel!=0||Harvested==null||Harvested.Length!=(Total+7)/8||Remaining==null||Remaining.Length!=Total/CellsPerParcel)throw new InvalidOperationException("Kayıt şeması veya tarla boyutu geçersiz");
            if(Bag<0||Vehicle<0||Hopper<0||Processed<0||Processed>Total||Xp!=Processed||Money<0||Earned<Money||double.IsNaN(Seconds)||double.IsInfinity(Seconds)||Seconds<0)throw new InvalidOperationException("Sayaçlar geçersiz");
            if(SelectedTool<0||SelectedTool>2||double.IsNaN(GrindCredit)||double.IsInfinity(GrindCredit)||GrindCredit<0||double.IsNaN(TractorCredit)||double.IsInfinity(TractorCredit)||TractorCredit<0)throw new InvalidOperationException("Simülasyon artığı geçersiz");
            if(Skills==null||Skills.Length!=7||Skills.Any(x=>x<0||x>3)||Points<0||Owned==null||Owned.Distinct().Count()!=Owned.Count||!Has("hand")||Owned.Any(id=>Catalog.Get(id)==null)||Bots==null)throw new InvalidOperationException("Ekipman veya beceri geçersiz");
            if(ActiveParcel<0||ActiveParcel>=Remaining.Length||Bots.Count(b=>b.Active)>8||Bots.Any(b=>Catalog.Get(b.ProductId)?.Category!="Filo"||b.Load<0||b.Load>Catalog.Get(b.ProductId).Capacity||b.Deliveries==null||b.Deliveries.Length!=240||b.Window<0||b.Window>=240||double.IsNaN(b.Travel)||b.Travel<0))throw new InvalidOperationException("Filo geçersiz");
            foreach(var p in Catalog.Products.Where(x=>x.Category=="Filo"))if(Bots.Count(b=>b.ProductId==p.Id)>p.Max)throw new InvalidOperationException("Robot sınırı aşıldı");
            for(int p=0;p<Remaining.Length;p++){int n=0;for(int i=0;i<CellsPerParcel;i++)if(!IsHarvested(p*CellsPerParcel+i))n++;if(Remaining[p]!=n)throw new InvalidOperationException("Parsel sayacı geçersiz");if(p<ActiveParcel&&n!=0)throw new InvalidOperationException("Parsel kilidi geçersiz");if(p>ActiveParcel&&n!=CellsPerParcel)throw new InvalidOperationException("Kilitli parsel değişmiş");}
            if((long)Ground+Bag+Vehicle+Hopper+Bots.Sum(b=>b.Load)+Processed!=Total||Won!=(Processed==Total)||HandTotal<0||BotTotal<0||TractorTotal<0||HandTotal+BotTotal+TractorTotal!=Total-Ground)throw new InvalidOperationException("Havuç muhasebesi geçersiz");
        }
    }
}
