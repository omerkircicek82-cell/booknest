using System;
using System.IO;
namespace MilyonHavuc.Core
{
    public sealed class SaveStore
    {
        readonly string path;
        readonly Func<Campaign,string> encode;
        readonly Func<string,Campaign> decode;
        public SaveStore(string path,Func<Campaign,string> encode,Func<string,Campaign> decode){this.path=path;this.encode=encode;this.decode=decode;}
        public bool Exists {get{return File.Exists(path)||File.Exists(path+".bak");}}
        Campaign Read(string file){var state=decode(File.ReadAllText(file));if(state==null)throw new InvalidDataException("Boş kayıt");state.Validate();return state;}
        public Campaign Load(out bool usedBackup)
        {
            usedBackup=false;
            try{return Read(path);}catch(Exception main){try{var s=Read(path+".bak");usedBackup=true;return s;}catch(Exception backup){throw new InvalidDataException("Ana kayıt ve yedek açılamadı. Dosyalar korunuyor.",new AggregateException(main,backup));}}
        }
        public void Save(Campaign state)
        {
            state.Validate();Directory.CreateDirectory(Path.GetDirectoryName(path));string temp=path+".tmp";
            File.WriteAllText(temp,encode(state));Read(temp);
            // Only a valid previous primary may replace the known-good backup.
            if(File.Exists(path)){bool valid=false;try{Read(path);valid=true;}catch(Exception){}if(valid)File.Copy(path,path+".bak",true);}
            if(File.Exists(path))File.Replace(temp,path,null);else File.Move(temp,path);
        }
    }
}
