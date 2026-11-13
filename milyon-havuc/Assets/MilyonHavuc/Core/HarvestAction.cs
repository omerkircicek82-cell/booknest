using System;
namespace MilyonHavuc.Core
{
    public sealed class HarvestAction
    {
        public double Progress {get;private set;}
        int target=-1;
        public void Cancel(){Progress=0;target=-1;}
        public int Advance(Campaign state,int cell,bool held,bool inRange,double dt)
        {
            if(!held||!inRange||!state.CanHarvest(cell)||state.Bag>=state.BagCapacity){Cancel();return 0;}
            if(target!=cell){Progress=0;target=cell;}
            Progress+=Math.Max(0,dt);
            if(Progress<state.HarvestTime)return 0;
            Progress=0;return state.Harvest(cell,state.HarvestAmount);
        }
    }
}
