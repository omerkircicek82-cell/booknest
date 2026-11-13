using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using MilyonHavuc.Core;
using UnityEngine;
using UnityEngine.Rendering;

namespace MilyonHavuc.Runtime
{
    public sealed class FarmGame : MonoBehaviour
    {
        Campaign state;
        readonly HarvestAction harvestAction=new HarvestAction();
        SaveStore saves;
        Camera eye;
        CharacterController controller;
        GameObject player,grinder,tractor,belt;
        readonly List<GameObject> robotVisuals=new List<GameObject>();
        Mesh carrotMesh,leafMesh;
        Material carrotMat,leafMat,soilMat,metalMat,woodMat,creamMat,greenMat;
        readonly Dictionary<int,Matrix4x4[]> chunks=new Dictionary<int,Matrix4x4[]>();
        readonly Dictionary<int,int> chunkCounts=new Dictionary<int,int>();
        readonly Matrix4x4[] batch=new Matrix4x4[400];
        Plane[] frustum;
        float yaw,pitch=60,action,stepClock,saveClock,toastClock,walkTime;
        int target=-1,tab,mapSelection;
        bool menu=true,paused,confirmNew,finalShown,loadError;
        string toast="",filter="Alet",error="";
        Vector2 scroll;
        float sensitivity=1.7f,fov=75,volume=.35f;
        bool shake=false,toggleHarvest,harvestToggle;
        AudioSource audioSource;
        AudioClip pullSound,grindSound;
        GUIStyle title,sub,label,small,button,card;
        Texture2D white;
        Transform gear;
        static readonly Color Ink=new Color(.12f,.19f,.13f),Cream=new Color(.97f,.95f,.87f),Orange=new Color(.98f,.48f,.17f),Green=new Color(.19f,.38f,.25f);
        [RuntimeInitializeOnLoadMethod(RuntimeInitializeLoadType.AfterSceneLoad)]
        static void Bootstrap(){if(FindObjectOfType<FarmGame>()==null)new GameObject("Milyon Havuç · Bootstrap").AddComponent<FarmGame>();}
        void Awake()
        {
            Application.targetFrameRate=60;
            sensitivity=PlayerPrefs.GetFloat("mh.sensitivity",1.7f);fov=PlayerPrefs.GetFloat("mh.fov",75);volume=PlayerPrefs.GetFloat("mh.volume",.35f);shake=PlayerPrefs.GetInt("mh.shake",0)==1;toggleHarvest=PlayerPrefs.GetInt("mh.toggle",0)==1;
            state=Campaign.New();WatchState();saves=new SaveStore(Path.Combine(Application.persistentDataPath,"milyon-havuc.json"),s=>JsonUtility.ToJson(s),s=>JsonUtility.FromJson<Campaign>(s));
            BuildWorld();MakeAudio();Cursor.lockState=CursorLockMode.None;
        }
        Material Mat(Color c){var shader=Shader.Find("Universal Render Pipeline/Lit")??Shader.Find("Standard");var m=new Material(shader){color=c,enableInstancing=true};m.SetFloat("_Smoothness",.08f);return m;}
        GameObject Box(string name,Vector3 position,Vector3 scale,Material material,Transform parent=null)
        {
            var o=GameObject.CreatePrimitive(PrimitiveType.Cube);o.name=name;o.transform.position=position;o.transform.localScale=scale;o.GetComponent<Renderer>().sharedMaterial=material;if(parent)o.transform.SetParent(parent,true);return o;
        }
        GameObject Shape(PrimitiveType type,string name,Vector3 pos,Vector3 scale,Material mat,Transform parent=null)
        {
            var o=GameObject.CreatePrimitive(type);o.name=name;o.transform.position=pos;o.transform.localScale=scale;o.GetComponent<Renderer>().sharedMaterial=mat;if(parent)o.transform.SetParent(parent,true);Destroy(o.GetComponent<Collider>());return o;
        }
        void Sign(string text,Vector3 pos,float size=1)
        {
            Box("Tabela",pos+Vector3.up*.9f,new Vector3(2.8f*size,1.2f*size,.12f),woodMat);
            Box("Direk",pos,new Vector3(.13f,1.8f,.13f),woodMat);
            var o=new GameObject("Yazı");o.transform.position=pos+Vector3.up*.9f+Vector3.back*.08f;var t=o.AddComponent<TextMesh>();t.text=text;t.fontSize=48;t.characterSize=.06f*size;t.anchor=TextAnchor.MiddleCenter;t.alignment=TextAlignment.Center;t.color=Cream;
        }
        void BuildWorld()
        {
            soilMat=Mat(new Color(.42f,.27f,.17f));carrotMat=Mat(Orange);leafMat=Mat(new Color(.28f,.52f,.18f));metalMat=Mat(new Color(.25f,.34f,.31f));woodMat=Mat(new Color(.33f,.23f,.14f));creamMat=Mat(Cream);greenMat=Mat(Green);
            RenderSettings.ambientLight=new Color(.67f,.73f,.68f);RenderSettings.fog=true;RenderSettings.fogColor=new Color(.76f,.83f,.73f);RenderSettings.fogMode=FogMode.Linear;RenderSettings.fogStartDistance=95;RenderSettings.fogEndDistance=200;
            var sun=new GameObject("Sabah güneşi").AddComponent<Light>();sun.type=LightType.Directional;sun.intensity=1.5f;sun.transform.rotation=Quaternion.Euler(38,-35,0);sun.shadows=LightShadows.Soft;
            Box("Dünya zemini",new Vector3(300,-.55f,300),new Vector3(1300,1,1300),Mat(new Color(.54f,.60f,.36f)));
            for(int p=0;p<100;p++)
            {
                Vector3 o=ParcelOrigin(p);Box("Parsel "+(p+1),o+new Vector3(27.225f,-.025f,27.225f),new Vector3(55,.04f,55),p<5?soilMat:Mat(p<20?new Color(.48f,.25f,.17f):p<55?new Color(.45f,.32f,.21f):new Color(.35f,.29f,.21f)));
                Sign((p+1).ToString("00"),o+new Vector3(-2,1,0),.5f);
                // Row strips communicate field scale without one GameObject per carrot.
                for(int r=0;r<20;r++)Box("Toprak sırası",o+new Vector3(27.2f,.012f,r*2.75f),new Vector3(54.6f,.035f,.10f),woodMat);
            }
            for(int i=0;i<=22;i++){float x=i*2.8f-4;Box("Çit direği",new Vector3(x,.65f,-8),new Vector3(.15f,1.3f,.15f),woodMat);if(i<22)for(int j=0;j<2;j++)Box("Çit",new Vector3(x+1.4f,.4f+j*.45f,-8),new Vector3(2.8f,.12f,.1f),woodMat);}
            Sign("MİLYON HAVUÇ\nBİR TARLA. BİR MİLYON KÖK.",new Vector3(5,1.4f,-7.8f),1.1f);
            grinder=new GameObject("Öğütücü");var gp=GrinderPosition;
            Box("Makine gövdesi",gp+Vector3.up*.65f,new Vector3(1.8f,1.2f,1.5f),metalMat,grinder.transform);
            Shape(PrimitiveType.Cylinder,"Huni",gp+Vector3.up*1.35f,new Vector3(1.5f,.15f,1.3f),creamMat,grinder.transform);
            gear=Shape(PrimitiveType.Cylinder,"Dönen dişli",gp+new Vector3(0,.8f,.85f),new Vector3(.7f,.12f,.7f),carrotMat,grinder.transform).transform;gear.rotation=Quaternion.Euler(90,0,0);
            Sign("ÖĞÜTÜCÜ\nE · ÇANTAYI DÖK",gp+new Vector3(2,1,0),.6f);
            player=new GameObject("Oyuncu");player.transform.position=new Vector3(0,0,-.7f);controller=player.AddComponent<CharacterController>();controller.height=1.75f;controller.radius=.22f;controller.center=new Vector3(0,.875f,0);controller.stepOffset=.25f;
            eye=new GameObject("Birinci şahıs kamera").AddComponent<Camera>();eye.tag="MainCamera";eye.transform.SetParent(player.transform);eye.transform.localPosition=new Vector3(0,1.6f,0);eye.nearClipPlane=.05f;eye.farClipPlane=220;eye.fieldOfView=fov;eye.clearFlags=CameraClearFlags.SolidColor;eye.backgroundColor=RenderSettings.fogColor;eye.gameObject.AddComponent<AudioListener>();
            carrotMesh=MakeCarrot();leafMesh=MakeLeaves();
            belt=Box("Bant teslimat girişi",Vector3.zero,new Vector3(1.6f,1,1.6f),carrotMat);belt.SetActive(false);
            tractor=new GameObject("Traktör");Box("Traktör kasa",new Vector3(0,.8f,0),new Vector3(1.4f,.6f,2.1f),greenMat,tractor.transform);Box("Traktör kabin",new Vector3(0,1.5f,-.35f),new Vector3(1.2f,1.1f,1),creamMat,tractor.transform);
            for(int i=0;i<4;i++){var w=Shape(PrimitiveType.Cylinder,"Tekerlek",new Vector3(i%2==0?-.8f:.8f,.4f,i/2==0?-.75f:.75f),new Vector3(.65f,.18f,.65f),metalMat,tractor.transform);w.transform.rotation=Quaternion.Euler(0,0,90);}tractor.transform.position=new Vector3(-4,0,-2);tractor.SetActive(false);
        }
        static Vector3 ParcelOrigin(int id){int row=id/10,col=row%2==0?id%10:9-id%10;return new Vector3(col*60,0,row*60);}
        Vector3 GrinderPosition {get{return state.Has("mobile")||state.Has("belt")?ParcelOrigin(state.ActiveParcel)+new Vector3(-2,0,-3):new Vector3(0,0,-5.5f);}}
        Vector3 BeltPosition {get{return ParcelOrigin(state.ActiveParcel)+new Vector3(56,0,27);}}
        Vector3 CellPosition(int id){int p=id/10000,n=id%10000;return ParcelOrigin(p)+new Vector3(n%100*.55f,0,n/100*.55f);}
        Mesh MakeCarrot()
        {
            var m=new Mesh();var v=new List<Vector3>();var triangles=new List<int>();
            v.Add(new Vector3(0,-.12f,0));for(int i=0;i<6;i++){float a=i*Mathf.PI/3;v.Add(new Vector3(Mathf.Cos(a)*.065f,.12f,Mathf.Sin(a)*.065f));}v.Add(new Vector3(0,.18f,0));
            for(int i=0;i<6;i++){int a=i+1,b=(i+1)%6+1;triangles.AddRange(new[]{0,b,a,7,a,b});}m.SetVertices(v);m.SetTriangles(triangles,0);m.RecalculateNormals();m.RecalculateBounds();return m;
        }
        Mesh MakeLeaves()
        {
            var m=new Mesh();var v=new List<Vector3>();var t=new List<int>();for(int i=0;i<4;i++){float a=i*Mathf.PI/2;Vector3 side=new Vector3(Mathf.Cos(a),0,Mathf.Sin(a));int n=v.Count;v.Add(Vector3.up*.12f-side*.03f);v.Add(Vector3.up*.40f+side*.14f);v.Add(Vector3.up*.17f+side*.045f);t.AddRange(new[]{n,n+1,n+2,n+2,n+1,n});}m.SetVertices(v);m.SetTriangles(t,0);m.RecalculateNormals();m.RecalculateBounds();return m;
        }
        void MakeAudio()
        {
            audioSource=gameObject.AddComponent<AudioSource>();pullSound=Tone(190,.09f);grindSound=Tone(75,.12f);
        }
        AudioClip Tone(float frequency,float duration){int n=(int)(22050*duration);float[] data=new float[n];for(int i=0;i<n;i++)data[i]=Mathf.Sin(i*frequency*2*Mathf.PI/22050)*(1-i/(float)n)*.2f;var c=AudioClip.Create("Toprak sesi",n,1,22050,false);c.SetData(data,0);return c;}
        void Sound(AudioClip clip){audioSource.PlayOneShot(clip,volume);}
        void StartCampaign(bool load,bool smallWorld=false)
        {
            if(load){try{state=saves.Load(out bool backup);if(backup)Notify("Yedek kayıt kurtarıldı.");loadError=false;}catch(Exception ex){error=ex.Message;loadError=true;return;}}
            else state=Campaign.New(smallWorld?10000:1000000);
            WatchState();ClearChunks();controller.enabled=false;Vector3 pos=new Vector3(state.PlayerX,0,state.PlayerZ);if(float.IsNaN(pos.x)||float.IsNaN(pos.z)||pos.x< -12||pos.z< -12||pos.x>610||pos.z>610)pos=GrinderPosition+Vector3.forward*3;player.transform.position=pos;controller.enabled=true;yaw=float.IsNaN(state.LookYaw)||float.IsInfinity(state.LookYaw)?0:state.LookYaw;pitch=float.IsNaN(state.LookPitch)||float.IsInfinity(state.LookPitch)?60:Mathf.Clamp(state.LookPitch,-75,80);if(!load)pitch=60;
            harvestAction.Cancel();stepClock=0;menu=false;paused=false;finalShown=false;confirmNew=false;saveClock=0;Lock(true);
            Notify(load?"Tarlana hoş geldin. Kaldığın yerden devam.":"Sol tuşu basılı tut ve ilk havucu sök.");
        }
        void Lock(bool locked){Cursor.lockState=locked?CursorLockMode.Locked:CursorLockMode.None;Cursor.visible=!locked;harvestToggle=false;harvestAction.Cancel();action=0;}
        void Notify(string text){toast=text;toastClock=5;}
        void Save()
        {
            state.PlayerX=player.transform.position.x;state.PlayerZ=player.transform.position.z;state.LookYaw=yaw;state.LookPitch=pitch;
            try{saves.Save(state);saveClock=0;}catch(Exception ex){Notify("Kayıt hatası: "+ex.Message);}
        }
        void Update()
        {
            float dt=Mathf.Min(Time.deltaTime,.1f);toastClock=Mathf.Max(0,toastClock-dt);
            if(menu){eye.transform.rotation=Quaternion.Euler(22,25,0);return;}
            if(Input.GetKeyDown(KeyCode.Escape)){paused=!paused;Lock(!paused);if(paused)Save();}
            if(Input.GetKeyDown(KeyCode.Tab)){paused=!paused;tab=0;Lock(!paused);}
            if(paused)return;
            if(Cursor.lockState!=CursorLockMode.Locked){if(Input.GetMouseButtonDown(0))Lock(true);return;}
            yaw+=Input.GetAxis("Mouse X")*sensitivity;pitch=Mathf.Clamp(pitch-Input.GetAxis("Mouse Y")*sensitivity,-75,80);
            player.transform.rotation=Quaternion.Euler(0,yaw,0);eye.transform.localRotation=Quaternion.Euler(pitch+(shake?Mathf.Sin(walkTime*12)*.25f:0),0,0);eye.fieldOfView=fov;
            Vector3 move=player.transform.forward*Input.GetAxisRaw("Vertical")+player.transform.right*Input.GetAxisRaw("Horizontal");move=Vector3.ClampMagnitude(move,1);float speed=state.Riding?9:Input.GetKey(KeyCode.LeftShift)?6.5f:4.5f;controller.Move((move*speed+Vector3.down*9)*dt);walkTime+=move.magnitude*dt;
            var pos=player.transform.position;pos.x=Mathf.Clamp(pos.x,-10,605);pos.z=Mathf.Clamp(pos.z,-10,605);controller.Move(pos-player.transform.position);if(pos.y< -3){controller.enabled=false;player.transform.position=GrinderPosition+Vector3.forward*3;controller.enabled=true;}
            if(Input.GetKeyDown(KeyCode.Alpha1))state.SelectedTool=0;if(Input.GetKeyDown(KeyCode.Alpha2))state.SelectedTool=1;if(Input.GetKeyDown(KeyCode.Alpha3))state.SelectedTool=2;
            UpdateTarget();
            if(Input.GetKeyDown(KeyCode.E))Interact();
            if(toggleHarvest&&Input.GetMouseButtonDown(0))harvestToggle=!harvestToggle;
            bool held=toggleHarvest?harvestToggle:Input.GetMouseButton(0);
            int picked=harvestAction.Advance(state,target,held&&!state.Riding,target>=0,dt);
            action=(float)harvestAction.Progress;
            if(picked>0){Sound(pullSound);if(state.HandTotal==1)Notify("Arkandaki öğütücüye yaklaş ve E ile dök.");}
            stepClock+=dt;
            while(stepClock>=.25f)
            {
                stepClock-=.25f;
                if(state.Riding&&move.sqrMagnitude>.01f&&target>=0){state.TractorCredit+=(state.Has("tractor_head")?155:110)*.25;int n=(int)state.TractorCredit;state.TractorCredit-=n;state.Harvest(target,n,true);}else state.TractorCredit=0;
                int oldParcel=state.ActiveParcel,oldBot=state.BotTotal,oldProcessed=state.Processed;state.Step();
                if(oldParcel!=state.ActiveParcel){Notify("Yeni parsel açıldı · "+(state.ActiveParcel+1));Save();}
                if(oldProcessed==0&&state.Processed>0){Notify("+1 ₵ · +1 XP  —  Tab ile dükkânı aç.");Sound(grindSound);}
                if(state.Ground==0&&!state.Won&&oldBot!=state.BotTotal)Notify("Tarla temiz. Son havuçları öğütücüye ulaştır.");
                saveClock+=.25f;if(saveClock>=60)Save();
            }
            if(state.Won&&!finalShown){Save();finalShown=true;paused=true;tab=5;Lock(false);}
            UpdateMachines(dt);
        }
        void UpdateTarget()
        {
            target=-1;Ray ray=new Ray(eye.transform.position,eye.transform.forward);if(ray.direction.y>=-.01f)return;float dist=-ray.origin.y/ray.direction.y;if(dist>(state.Riding?6:state.Reach))return;Vector3 hit=ray.GetPoint(dist);
            for(int p=Math.Max(0,state.ActiveParcel-1);p<=state.ActiveParcel;p++){Vector3 local=hit-ParcelOrigin(p);int x=Mathf.RoundToInt(local.x/.55f),z=Mathf.RoundToInt(local.z/.55f);if(x<0||x>=100||z<0||z>=100)continue;int cell=p*10000+z*100+x;if(state.CanHarvest(cell)){target=cell;break;}}
        }
        bool Near(Vector3 p){Vector3 a=player.transform.position;a.y=0;return Vector3.Distance(a,p)<2.5f;}
        void Interact()
        {
            if(Near(GrinderPosition)||(state.Has("belt")&&Near(BeltPosition)))
            {
                int n=state.Deposit(state.Riding);if(n>0){Notify(n+" havuç hazneye aktarıldı.");Sound(pullSound);return;}
                if(state.Riding){state.Riding=false;Notify("Traktörden indin.");return;}Notify(state.Bag==0?"Çanta boş.":"Hazne dolu · yer açılmasını bekle.");return;
            }
            if(state.Riding){state.Riding=false;tractor.transform.position=player.transform.position+player.transform.right*2;Notify("Traktörden indin.");return;}
            if(state.Has("tractor")&&Near(tractor.transform.position)){state.Riding=true;Notify("Traktör · sürerken önündeki kökleri toplar. E ile in.");return;}
            Notify("Teslim için öğütücüye veya bant girişine yaklaş.");
        }
        void UpdateMachines(float dt)
        {
            grinder.transform.position=GrinderPosition-new Vector3(0,0,-5.5f);if(state.Hopper>0)gear.Rotate(Vector3.up,dt*360,Space.Self);
            belt.SetActive(state.Has("belt"));belt.transform.position=BeltPosition+Vector3.up*.5f;
            tractor.SetActive(state.Has("tractor")&&!state.Riding);
            while(robotVisuals.Count<state.Bots.Count)
            {
                var o=new GameObject("Hasat robotu");Shape(PrimitiveType.Capsule,"Bot gövdesi",Vector3.up*.55f,new Vector3(.6f,.45f,.6f),greenMat,o.transform);Shape(PrimitiveType.Sphere,"Optik",new Vector3(0,.85f,.2f),new Vector3(.22f,.22f,.22f),carrotMat,o.transform);Box("Yük kasası",new Vector3(0,.45f,-.4f),new Vector3(.7f,.4f,.6f),woodMat,o.transform);robotVisuals.Add(o);
            }
            for(int i=0;i<robotVisuals.Count;i++){var o=robotVisuals[i];if(i>=state.Bots.Count){o.SetActive(false);continue;}o.SetActive(true);var b=state.Bots[i];Vector3 dest=b.Status=="Hasat"?CellPosition(Math.Min(state.Total-1,b.Parcel*10000+b.Cursor)):GrinderPosition+Vector3.right*(i*.6f+2);o.transform.position=Vector3.MoveTowards(o.transform.position,dest,dt*6);}
        }
        void LateUpdate()
        {
            if(eye==null)return;frustum=GeometryUtility.CalculateFrustumPlanes(eye);
            int parcel=state.ActiveParcel;
            for(int p=Math.Max(0,parcel-1);p<=Math.Min(state.Remaining.Length-1,parcel+10);p++)
            {
                Vector3 origin=ParcelOrigin(p);
                for(int z=0;z<5;z++)for(int x=0;x<5;x++)
                {
                    Vector3 center=origin+new Vector3(x*11+5.2f,.2f,z*11+5.2f);if(Vector3.Distance(center,eye.transform.position)>65||!GeometryUtility.TestPlanesAABB(frustum,new Bounds(center,new Vector3(11,1,11))))continue;
                    int key=p*25+z*5+x;if(!chunks.TryGetValue(key,out Matrix4x4[] matrices))
                    {
                        int n=0;for(int rz=0;rz<20;rz++)for(int rx=0;rx<20;rx++){int id=p*10000+(z*20+rz)*100+x*20+rx;if(state.IsHarvested(id))continue;batch[n++]=Matrix4x4.TRS(CellPosition(id),Quaternion.Euler(0,(id*37)%360,0),Vector3.one);}
                        matrices=new Matrix4x4[n];Array.Copy(batch,matrices,n);chunks[key]=matrices;chunkCounts[key]=n;
                    }
                    if(matrices.Length==0)continue;Graphics.DrawMeshInstanced(carrotMesh,0,carrotMat,matrices,matrices.Length,null,ShadowCastingMode.Off,true);Graphics.DrawMeshInstanced(leafMesh,0,leafMat,matrices,matrices.Length,null,ShadowCastingMode.Off,true);
                }
            }
        }
        void WatchState(){state.CellRemoved+=id=>{int n=id%10000;int key=id/10000*25+n/100/20*5+n%100/20;chunks.Remove(key);chunkCounts.Remove(key);};}
        void ClearChunks(){chunks.Clear();chunkCounts.Clear();}
        void OnApplicationQuit(){if(!menu&&!loadError)Save();}
        void OnApplicationFocus(bool focus){if(!focus&&!menu){paused=true;Lock(false);}}
        void Styles()
        {
            if(title!=null)return;white=Texture2D.whiteTexture;
            title=new GUIStyle(GUI.skin.label){fontSize=38,fontStyle=FontStyle.Bold,wordWrap=true};title.normal.textColor=Cream;
            sub=new GUIStyle(GUI.skin.label){fontSize=19,wordWrap=true};sub.normal.textColor=Cream;
            label=new GUIStyle(GUI.skin.label){fontSize=16,wordWrap=true};label.normal.textColor=Cream;
            small=new GUIStyle(GUI.skin.label){fontSize=13,wordWrap=true};small.normal.textColor=new Color(.78f,.83f,.74f);
            button=new GUIStyle(GUI.skin.button){fontSize=15,padding=new RectOffset(14,14,10,10),wordWrap=true};
            card=new GUIStyle(GUI.skin.box){padding=new RectOffset(16,16,12,12)};
        }
        void Fill(Rect r,Color c){Color old=GUI.color;GUI.color=c;GUI.DrawTexture(r,white);GUI.color=old;}
        void Text(Rect r,string text,GUIStyle style=null){GUI.Label(r,text,style??label);}
        void Bar(Rect r,float value,Color c){Fill(r,new Color(.23f,.29f,.23f));r.width*=Mathf.Clamp01(value);Fill(r,c);}
        bool Btn(Rect r,string text,bool enabled=true){bool old=GUI.enabled;GUI.enabled=enabled;bool pressed=GUI.Button(r,text,button);GUI.enabled=old;return pressed;}
        string Count(int n){return n.ToString("N0");}
        string Money(long cents){return (cents/100.0).ToString("N2")+" ₵";}
        string Duration(double seconds){var t=TimeSpan.FromSeconds(seconds);return ((int)t.TotalHours).ToString("00")+":"+t.Minutes.ToString("00")+":"+t.Seconds.ToString("00");}
        void OnGUI()
        {
            Styles();float scale=Mathf.Min(Screen.width/1440f,Screen.height/900f);GUI.matrix=Matrix4x4.TRS(Vector3.zero,Quaternion.identity,Vector3.one*scale);float w=Screen.width/scale,h=Screen.height/scale;
            if(menu){MainMenu(w,h);return;}
            Hud(w,h);
            if(paused){Fill(new Rect(0,0,w,h),new Color(.035f,.07f,.04f,.91f));Panel(w,h);}
            if(toastClock>0){Fill(new Rect(w/2-320,h-100,640,52),Ink);Text(new Rect(w/2-300,h-88,600,42),toast,sub);}
        }
        void MainMenu(float w,float h)
        {
            Fill(new Rect(0,0,w,h),new Color(.04f,.09f,.05f,.65f));
            Fill(new Rect(70,75,48,5),Orange);Text(new Rect(70,100,600,35),"SONLU BİR TARLA · SONSUZ BİR TATMİN",small);
            Text(new Rect(65,150,700,150),"MİLYON\nHAVUÇ",new GUIStyle(title){fontSize=78});
            Text(new Rect(70,340,510,80),"İlk kökü elinle sök. Kendi hasat filonu kur.\nSon havuca kadar tarlanı dönüştür.",sub);
            if(saves.Exists&&Btn(new Rect(70,455,310,54),"Tarlama dön  →"))StartCampaign(true);
            if(Btn(new Rect(70,590,310,44),"Oyundan çık"))Application.Quit();
            if(Btn(new Rect(70,520,310,54),"Yeni kampanya")){if(saves.Exists)confirmNew=true;else StartCampaign(false);}
            Text(new Rect(70,h-90,800,45),"WASD · hareket    FARE · bakış    SOL TUŞ · hasat    E · dök    TAB · yönetim",small);
            Text(new Rect(w-350,100,280,100),"1.000.000\nKÖK. TEK BİR HEDEF.",sub);
            if(confirmNew){Fill(new Rect(430,450,540,160),Ink);Text(new Rect(450,465,500,65),"Yeni kampanya mevcut kaydın yerini alacak. Devam edilsin mi?",sub);if(Btn(new Rect(450,540,230,45),"Evet, yeni tarla"))StartCampaign(false);if(Btn(new Rect(695,540,230,45),"Vazgeç"))confirmNew=false;}
#if UNITY_EDITOR || DEVELOPMENT_BUILD
            if(!saves.Exists&&Btn(new Rect(w-420,h-120,350,46),"Geliştirici: 10.000 köklük test dünyası"))StartCampaign(false,true);
#endif
            if(error!="")Text(new Rect(430,640,700,100),error,sub);
        }
        void Hud(float w,float h)
        {
            Fill(new Rect(25,24,430,110),Ink);Text(new Rect(45,37,380,30),"MİLYON HAVUÇ",sub);Text(new Rect(45,71,385,24),"İşlenen  "+Count(state.Processed)+" / "+Count(state.Total));Bar(new Rect(45,109,385,5),state.Processed/(float)state.Total,Orange);
            Fill(new Rect(w-300,24,275,110),Ink);Text(new Rect(w-280,35,240,30),Money(state.Money),sub);int next=Catalog.Xp.FirstOrDefault(x=>x>state.Xp);Text(new Rect(w-280,73,240,45),"Seviye "+state.Level+" · "+state.Points+" beceri puanı\n"+(next>0?Count(next-state.Xp)+" XP → sonraki seviye":"Tüm XP eşikleri tamamlandı"),small);
            Text(new Rect(45,147,700,26),"TOPRAKTA "+Count(state.Ground)+"   ·   PARSEL "+(state.ActiveParcel+1).ToString("00")+" / "+state.Remaining.Length+"   ·   KALAN "+Count(state.Remaining[state.ActiveParcel]),small);
            if(!paused)
            {
                Fill(new Rect(w/2-2,h/2-2,4,4),target>=0?Orange:Cream);
                if(action>0)Bar(new Rect(w/2-35,h/2+20,70,5),(float)(action/state.HarvestTime),Orange);
                string hint="";
                if(Near(GrinderPosition)||(state.Has("belt")&&Near(BeltPosition)))hint="E · DÖK   |   Hazne "+Count(state.Hopper)+" / "+Count(state.HopperCapacity)+"   ·   "+state.GrindRate.ToString("0.#")+"/s";
                else if(state.Riding)hint="Sürerken hasat · E ile in";
                else if(state.Bag>=state.BagCapacity)hint="ÇANTA DOLU · Öğütücüye dön ve E ile dök";
                else if(target>=0)hint="SOL TUŞU BASILI TUT · "+state.HarvestAmount+" köke kadar";
                if(hint!=""){Fill(new Rect(w/2-310,h/2+60,620,44),Ink);Text(new Rect(w/2-295,h/2+70,590,30),hint,small);}
                if(state.Has("scanner")||state.Remaining[state.ActiveParcel]<=50)
                {
                    Vector3 lp=player.transform.position-ParcelOrigin(state.ActiveParcel);int local=Mathf.Clamp(Mathf.RoundToInt(lp.z/.55f),0,99)*100+Mathf.Clamp(Mathf.RoundToInt(lp.x/.55f),0,99);int id=state.NearestSpatial(state.ActiveParcel,local);if(id>=0){Vector3 d=CellPosition(id)-player.transform.position;float angle=Vector3.SignedAngle(player.transform.forward,d,Vector3.up);Text(new Rect(w/2-220,177,440,50),"KÖK İŞARETİ  "+(Mathf.Abs(angle)<15?"↑":angle<0?"←":"→")+"   "+d.magnitude.ToString("0")+" m",sub);}
                }
                if(state.Ground==0)Text(new Rect(w/2-350,220,700,70),"Tarla temiz. Son yükleri öğütücüye ulaştır.\nÇanta "+state.Bag+" · Araç "+state.Vehicle+" · Botlar "+state.Bots.Sum(b=>b.Load)+" · Hazne "+state.Hopper,sub);
            }
            Fill(new Rect(25,h-115,400,90),Ink);Text(new Rect(45,h-100,370,28),state.Riding?"SIRA TRAKTÖRÜ":state.Tool.Name.ToUpperInvariant(),sub);int load=state.Riding?state.Vehicle:state.Bag,cap=state.Riding?state.VehicleCapacity:state.BagCapacity;Text(new Rect(45,h-67,360,25),(state.Riding?"Kasa  ":"Çanta  ")+Count(load)+" / "+Count(cap));Bar(new Rect(45,h-37,360,4),load/(float)cap,Orange);
            Text(new Rect(w-370,h-80,340,52),"TAB · Dükkân / Beceri / Harita / Filo\nESC · Duraklat     "+Duration(state.Seconds),small);
        }
        void Panel(float w,float h)
        {
            float x=(w-1160)/2,y=70;Text(new Rect(x,y,900,45),tab==5?"TARLA ARTIK BOŞ.":"TARLANIN KONTROLÜ SENDE",title);
            if(Btn(new Rect(x+970,y,190,40),"Tarlaya dön  ×")){paused=false;Lock(true);}
            string[] tabs={"Dükkân","Beceriler","Tarla haritası","Filo","Ayarlar ve kayıt"};for(int i=0;i<5;i++)if(Btn(new Rect(x+i*228,y+65,218,42),(tab==i?"● ":"")+tabs[i])){tab=i;scroll=Vector2.zero;}
            Rect content=new Rect(x,y+135,1160,h-260);
            if(tab==0)Shop(content);else if(tab==1)Skills(content);else if(tab==2)Map(content);else if(tab==3)Fleet(content);else if(tab==4)Settings(content);else Victory(content);
            Text(new Rect(x,h-60,1160,30),"Dünya duraklatıldı · Otomasyon ve kampanya süresi menü açıkken ilerlemez.",small);
        }
        void Shop(Rect r)
        {
            string[] filters={"Alet","Taşıma","Öğütme","Filo","Araç","Destek"};for(int i=0;i<filters.Length;i++)if(Btn(new Rect(r.x+i*160,r.y,150,35),(filter==filters[i]?"● ":"")+filters[i])){filter=filters[i];scroll=Vector2.zero;}
            var products=Catalog.Products.Where(p=>p.Category==filter&&p.Id!="hand").ToArray();int rows=(products.Length+1)/2;
            scroll=GUI.BeginScrollView(new Rect(r.x,r.y+50,r.width,r.height-50),scroll,new Rect(0,0,r.width-25,rows*146));
            for(int i=0;i<products.Length;i++)
            {
                var p=products[i];float x=i%2*565,y=i/2*146;Fill(new Rect(x,y,550,132),new Color(.12f,.22f,.15f));Fill(new Rect(x,y,4,132),Orange);Text(new Rect(x+20,y+12,350,27),p.Name,sub);Text(new Rect(x+20,y+46,490,38),p.Description,small);
                string reason=state.BuyReason(p);int copies=state.Bots.Count(b=>b.ProductId==p.Id);Text(new Rect(x+20,y+93,250,32),p.Category=="Filo"?copies+" / "+p.Max+" robot · "+state.Price(p).ToString("N0")+" ₵":state.Price(p).ToString("N0")+" ₵");
                if(Btn(new Rect(x+270,y+86,260,36),reason==""?"Satın al  →":reason,reason=="")){state.Buy(p.Id);Save();Notify(p.Name+" hazır.");}
            }
            GUI.EndScrollView();
        }
        readonly string[,] skillEffects={
            {"El +1 · Alet ×1,25","El +2 · Alet ×1,50","El +3 · Alet ×1,80"},
            {"Eylem süresi −%10","Eylem süresi −%20","Eylem süresi −%32"},
            {"Çanta +%15","Çanta +%30","Çanta +%50"},
            {"Para +%10","Para +%20","Para +%35"},
            {"Öğütme hızı +%10","Öğütme hızı +%20","Öğütme hızı +%30"},
            {"Bot söküm hızı +%8","Bot söküm hızı +%16","Bot söküm hızı +%25"},
            {"Hazne +%15","Hazne +%30","Hazne +%50"}};
        void Skills(Rect r)
        {
            Text(new Rect(r.x,r.y,700,40),state.Points+" KULLANILABİLİR PUAN · "+Count(state.Xp)+" TOPLAM XP",sub);
            if(Btn(new Rect(r.x+830,r.y,300,38),"Ücretsiz yeniden dağıt")){state.ResetSkills();Save();Notify("Beceriler sıfırlandı; mevcut yük korundu.");}
            scroll=GUI.BeginScrollView(new Rect(r.x,r.y+55,r.width,r.height-55),scroll,new Rect(0,0,r.width-25,7*72));
            for(int i=0;i<7;i++)
            {
                Fill(new Rect(0,i*72,1130,62),Ink);Text(new Rect(15,i*72+18,245,30),Catalog.BranchNames[i],sub);
                for(int j=0;j<3;j++){int cost=i==6?1:j+1;string s=(j<state.Skills[i]?"✓ ":"")+skillEffects[i,j]+" · "+cost+" puan";if(Btn(new Rect(270+j*280,i*72+10,270,42),s,j==state.Skills[i]&&state.Points>=cost)){state.Learn(i);Save();}}
            }
            GUI.EndScrollView();
        }
        void Map(Rect r)
        {
            float cell=Mathf.Min(46,(r.height-30)/10);for(int row=0;row<10;row++)for(int col=0;col<10;col++)
            {
                int p=row*10+(row%2==0?col:9-col);if(p>=state.Remaining.Length)continue;Color old=GUI.backgroundColor;GUI.backgroundColor=p<state.ActiveParcel?Green:p==state.ActiveParcel?Orange:Color.gray;string text=(p<state.ActiveParcel?"✓ ":p>state.ActiveParcel?"· ":"▶ ")+(p+1).ToString("00");if(Btn(new Rect(r.x+col*(cell+5),r.y+row*(cell+5),cell,cell),text))mapSelection=p;GUI.backgroundColor=old;
            }
            float xx=r.x+560;Text(new Rect(xx,r.y,550,50),"PARSEL "+(mapSelection+1).ToString("00"),title);Text(new Rect(xx,r.y+70,540,120),(mapSelection<state.ActiveParcel?"✓ Temizlendi":mapSelection==state.ActiveParcel?"▶ Aktif parsel":"· Kilitli")+"\nToprakta "+Count(state.Remaining[mapSelection])+" havuç\nAtanan robot "+state.Bots.Count(b=>b.Parcel==mapSelection),sub);
            string region=mapSelection<5?"Başlangıç Ovası":mapSelection<20?"Kızıl Sırt":mapSelection<55?"Rüzgâr Yolu":"Son Hat";Text(new Rect(xx,r.y+215,540,100),region+"\nBir sonraki parsel, aktif parselde toprak boşalınca açılır.",label);
            Vector3 offset=ParcelOrigin(state.ActiveParcel)-player.transform.position;Text(new Rect(xx,r.y+340,500,80),"Aktif parsele uzaklık: "+offset.magnitude.ToString("0")+" m\nServis yuvası: "+(state.Has("mobile")?"Mobil öğütücü":"Başlangıç öğütücüsü"),small);
        }
        void Fleet(Rect r)
        {
            Text(new Rect(r.x,r.y,1000,45),state.Bots.Count(b=>b.Active)+" / 8 AKTİF YUVA    ·    "+state.Bots.Sum(b=>b.LastMinute).ToString("0.00")+" havuç/s teslimat",sub);
            if(state.Bots.Count==0){Text(new Rect(r.x,r.y+80,900,100),"İlk Fidebot seni bekliyor.\n450 havuç işledikten sonra dükkândan 550 ₵ karşılığında alabilirsin.",sub);return;}
            scroll=GUI.BeginScrollView(new Rect(r.x,r.y+60,r.width,r.height-60),scroll,new Rect(0,0,r.width-25,state.Bots.Count*90));
            for(int i=0;i<state.Bots.Count;i++)
            {
                var b=state.Bots[i];var p=Catalog.Get(b.ProductId);float yy=i*90;Fill(new Rect(0,yy,1130,80),Ink);Text(new Rect(18,yy+12,240,32),p.Name+" #"+(i+1),sub);Text(new Rect(18,yy+46,280,28),b.Status,small);Text(new Rect(300,yy+14,270,55),"Yük "+b.Load+" / "+p.Capacity+"\nSöküm "+(p.Rate*new[]{1,1.08,1.16,1.25}[state.Skills[5]]).ToString("0.#")+"/s",label);Text(new Rect(600,yy+14,210,55),"Son 60 sn teslimat\n"+b.LastMinute.ToString("0.00")+"/s",small);
                if(state.Has("fleet_console")&&i>0&&Btn(new Rect(800,yy+18,90,42),"Öne al")){var previous=state.Bots[i-1];state.Bots[i-1]=b;state.Bots[i]=previous;Save();}
                if(Btn(new Rect(900,yy+18,210,42),b.Active?"Garaja gönder":"Çalıştır")){if(!state.ToggleBot(i))Notify("8 aktif yuva dolu.");Save();}
            }
            GUI.EndScrollView();
        }
        void Settings(Rect r)
        {
            Text(new Rect(r.x,r.y,600,35),"SANA GÖRE BİR TARLA",sub);Text(new Rect(r.x,r.y+55,300,25),"Fare hassasiyeti  "+sensitivity.ToString("0.0"));sensitivity=GUI.HorizontalSlider(new Rect(r.x+310,r.y+65,350,22),sensitivity,.3f,4);
            Text(new Rect(r.x,r.y+105,300,25),"Görüş alanı  "+fov.ToString("0"));fov=GUI.HorizontalSlider(new Rect(r.x+310,r.y+115,350,22),fov,55,100);
            Text(new Rect(r.x,r.y+155,300,25),"Ses seviyesi  %"+(volume*100).ToString("0"));volume=GUI.HorizontalSlider(new Rect(r.x+310,r.y+165,350,22),volume,0,1);
            toggleHarvest=GUI.Toggle(new Rect(r.x,r.y+215,600,32),toggleHarvest,"  Tıklayarak hasadı aç / kapat (basılı tutmak yerine)",label);
            shake=GUI.Toggle(new Rect(r.x,r.y+255,600,32),shake,"  Hasat sırasında hafif kamera hareketi",label);
            if(Btn(new Rect(r.x,r.y+320,300,45),"Ayarları kaydet")){PlayerPrefs.SetFloat("mh.sensitivity",sensitivity);PlayerPrefs.SetFloat("mh.fov",fov);PlayerPrefs.SetFloat("mh.volume",volume);PlayerPrefs.SetInt("mh.toggle",toggleHarvest?1:0);PlayerPrefs.SetInt("mh.shake",shake?1:0);PlayerPrefs.Save();Notify("Ayarlar kaydedildi.");}
            if(Btn(new Rect(r.x+330,r.y+320,300,45),"Kampanyayı kaydet")){Save();Notify("Kampanya kaydedildi.");}
            if(Btn(new Rect(r.x,r.y+385,300,45),"Kaydet ve ana menü")){Save();menu=true;paused=false;Lock(false);}
            Text(new Rect(r.x+760,r.y+60,350,220),"KAYIT HAKKINDA\n\n60 saniyede bir otomatik kayıt.\nÖnemli alışveriş ve parsel açılışında kayıt.\nBir önceki sağlam kayıt yedeklenir.\nKapalıyken üretim ilerlemez.",small);
        }
        void Victory(Rect r)
        {
            Text(new Rect(r.x,r.y,1000,70),Count(state.Total)+" kökün her biri işlendi.\nBir havuçla başlayan hikâye tamamlandı.",sub);
            Text(new Rect(r.x,r.y+110,1000,250),"KAMPANYA SÜRESİ     "+Duration(state.Seconds)+"\n\nELLE TOPLANAN          "+Count(state.HandTotal)+"\nARAÇLA TOPLANAN    "+Count(state.TractorTotal)+"\nROBOT KATKISI              "+Count(state.BotTotal)+"\n\nTOPLAM KAZANÇ          "+Money(state.Earned)+"\nEN YÜKSEK TESLİMAT  "+state.HighestRate.ToString("0.00")+"/s",sub);
            if(Btn(new Rect(r.x,r.y+390,330,48),"Boş tarlada dolaş")){paused=false;Lock(true);}if(Btn(new Rect(r.x+360,r.y+390,330,48),"Ana menü")){menu=true;paused=false;Lock(false);}
        }
    }
}
