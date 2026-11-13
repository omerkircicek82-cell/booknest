using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text.Json;
using MilyonHavuc.Core;
static class Simulation
{
    public static void Run()
    {
        var reports=new List<object>();
        foreach(string policy in new[]{"aktif","karma","otomasyon"})
        {
            var s=Campaign.New();var purchases=new List<object>();var marks=new Dictionary<int,double>();
            int cursor=0,lastParcel=0;double harvest=0,travel=0,empty=0,full=0,lastThousand=-1;int tick=0;
            string[] common={"bucket_small","hoe","bucket_large","hopper","rake","basket","motor","row_lifter","cart","mobile","power_lifter","trailer","belt","wide_head","root_vac","belt_pack","dual_line","bulk_bag","industrial","factory"};
            while(!s.Won&&s.Seconds<86400)
            {
                if(tick%20==0)
                {
                    // Deterministic policies use the actual catalogue and purchasing rules.
                    var order=new List<string>(common);
                    if(policy!="otomasyon"){order.Insert(order.IndexOf("bulk_bag"),"tractor");order.Add("tractor_head");}
                    if(policy!="aktif")order.InsertRange(policy=="karma"?5:2,new[]{"bot_seed","bot_row","bot_dig","drone","bot_auto","route_ai","bot_heavy","sweep"});
                    foreach(string id in order)
                    {
                        var p=Catalog.Get(id);if(p.Category=="Filo"&&s.Bots.Count(b=>b.ProductId==id)>=(policy=="otomasyon"?Math.Min(p.Max,3):Math.Min(p.Max,2)))continue;
                        if(s.BuyReason(p)==""){int paid=s.Price(p);s.Buy(id);purchases.Add(new{minutes=Math.Round(s.Seconds/60,2),id,price=paid});break;}
                    }
                    // Prefer stronger robots once eight slots fill, without discarding their loads.
                    var active=s.Bots.OrderByDescending(b=>Catalog.Get(b.ProductId).Rate).Take(8).ToHashSet();
                    for(int i=0;i<s.Bots.Count;i++)if(s.Bots[i].Active&&!active.Contains(s.Bots[i]))s.ToggleBot(i);
                    for(int i=0;i<s.Bots.Count;i++)if(!s.Bots[i].Active&&active.Contains(s.Bots[i]))s.ToggleBot(i);
                    int[] priority=policy=="aktif"?new[]{0,1,2,3,4,6,5}:policy=="karma"?new[]{0,3,5,4,1,2,6}:new[]{3,5,4,6,0,1,2};
                    foreach(int branch in priority)if(s.Learn(branch))break;
                    s.SelectedTool=2;
                }
                if(s.ActiveParcel!=lastParcel){travel+=12;lastParcel=s.ActiveParcel;cursor=0;}
                bool riding=s.Has("tractor");
                if(riding&&s.Bag>0)s.Deposit();
                if(travel>0)travel-=.25;
                else if((riding?s.Vehicle>=s.VehicleCapacity:s.Bag>=s.BagCapacity)||(s.Ground==0&&(riding?s.Vehicle>0:s.Bag>0)))
                {
                    int delivered=s.Deposit(riding);if(delivered>0)travel=12/(riding?9:4.5)+.4;
                }
                else if(s.Ground>0)
                {
                    // 12% decision/reading downtime; automation continues during modeled idle.
                    if(riding){s.TractorCredit+=(s.Has("tractor_head")?155:110)*.25*.88;int n=(int)s.TractorCredit;s.TractorCredit-=n;int cell=s.NearestLive(s.ActiveParcel,cursor);if(cell>=0){s.Harvest(cell,n,true);cursor=(cell%10000+1)%10000;}}
                    harvest+=riding?0:.25*.88;
                    if(harvest>=s.HarvestTime)
                    {
                        harvest-=s.HarvestTime;int id=s.NearestLive(s.ActiveParcel,cursor);if(id>=0){s.Harvest(id,s.HarvestAmount);cursor=(id%10000+1)%10000;}
                    }
                }
                if(s.Hopper==0)empty+=.25;if(s.Hopper>=s.HopperCapacity)full+=.25;
                s.Step();tick++;
                foreach(int threshold in new[]{1000,10000,50000,200000,500000})if(s.Processed>=threshold&&!marks.ContainsKey(threshold))marks[threshold]=Math.Round(s.Seconds/60,2);
                if(s.Ground<=1000&&lastThousand<0)lastThousand=s.Seconds;
            }
            s.Validate();var result=new{policy,completed=s.Won,minutes=Math.Round(s.Seconds/60,2),milestonesMinutes=marks,purchases,finalMoney=s.Money/100.0,grinderEmptyMinutes=Math.Round(empty/60,2),hopperFullMinutes=Math.Round(full/60,2),lastThousandMinutes=lastThousand<0?(double?)null:Math.Round((s.Seconds-lastThousand)/60,2),hand=s.HandTotal,bots=s.BotTotal,tractor=s.TractorTotal,processed=s.Processed};reports.Add(result);Console.WriteLine($"{policy}: {result.minutes} dk, tamamlandı={s.Won}, işlenen={s.Processed}");
        }
        string path=Path.Combine(Directory.GetCurrentDirectory(),"docs","simulation-results.json");Directory.CreateDirectory(Path.GetDirectoryName(path));File.WriteAllText(path,JsonSerializer.Serialize(reports,new JsonSerializerOptions{WriteIndented=true}));Console.WriteLine(path);
    }
}
