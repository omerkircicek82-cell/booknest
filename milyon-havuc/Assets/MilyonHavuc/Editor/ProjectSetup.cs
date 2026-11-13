#if UNITY_EDITOR
using System.IO;
using UnityEditor;
using UnityEditor.Build;
using UnityEditor.SceneManagement;
using UnityEngine;
using UnityEngine.Rendering;
using UnityEngine.Rendering.Universal;
namespace MilyonHavuc.Editor
{
    [InitializeOnLoad] public static class ProjectSetup
    {
        static ProjectSetup(){EditorApplication.delayCall+=Initialize;}
        static void Initialize()
        {
            if(EditorApplication.isPlayingOrWillChangePlaymode||EditorApplication.isCompiling)return;
            Directory.CreateDirectory("Assets/Settings");Directory.CreateDirectory("Assets/Scenes");
            if(!File.Exists("Assets/Settings/FarmPipeline.asset"))
            {
                var renderer=ScriptableObject.CreateInstance<UniversalRendererData>();AssetDatabase.CreateAsset(renderer,"Assets/Settings/FarmRenderer.asset");
                var pipeline=UniversalRenderPipelineAsset.Create(renderer);pipeline.name="FarmPipeline";pipeline.supportsHDR=false;pipeline.msaaSampleCount=2;pipeline.shadowDistance=35;AssetDatabase.CreateAsset(pipeline,"Assets/Settings/FarmPipeline.asset");
            }
            var asset=AssetDatabase.LoadAssetAtPath<UniversalRenderPipelineAsset>("Assets/Settings/FarmPipeline.asset");GraphicsSettings.defaultRenderPipeline=asset;QualitySettings.renderPipeline=asset;
            // Runtime materials use Shader.Find, so explicitly retain their shaders in builds.
            var graphics=new SerializedObject(AssetDatabase.LoadAllAssetsAtPath("ProjectSettings/GraphicsSettings.asset")[0]);
            var shaders=graphics.FindProperty("m_AlwaysIncludedShaders");
            foreach(string name in new[]{"Universal Render Pipeline/Lit","GUI/Text Shader"})
            {
                var shader=Shader.Find(name);if(shader==null)continue;bool found=false;
                for(int i=0;i<shaders.arraySize;i++)if(shaders.GetArrayElementAtIndex(i).objectReferenceValue==shader)found=true;
                if(!found){int i=shaders.arraySize;shaders.InsertArrayElementAtIndex(i);shaders.GetArrayElementAtIndex(i).objectReferenceValue=shader;}
            }
            graphics.ApplyModifiedPropertiesWithoutUndo();
            PlayerSettings.companyName="Booknest";PlayerSettings.productName="Milyon Havuç";PlayerSettings.defaultScreenWidth=1440;PlayerSettings.defaultScreenHeight=900;PlayerSettings.runInBackground=false;
            PlayerSettings.SetScriptingBackend(NamedBuildTarget.Standalone,ScriptingImplementation.Mono2x);
            // Legacy Input Manager is a single, dependency-free PC input path.
            var settings=new SerializedObject(AssetDatabase.LoadAllAssetsAtPath("ProjectSettings/ProjectSettings.asset")[0]);var input=settings.FindProperty("activeInputHandler");if(input!=null&&input.intValue!=0){input.intValue=0;settings.ApplyModifiedPropertiesWithoutUndo();}
            if(!File.Exists("Assets/Scenes/Farm.unity")){var scene=EditorSceneManager.NewScene(NewSceneSetup.EmptyScene,NewSceneMode.Single);EditorSceneManager.SaveScene(scene,"Assets/Scenes/Farm.unity");}
            EditorBuildSettings.scenes=new[]{new EditorBuildSettingsScene("Assets/Scenes/Farm.unity",true)};AssetDatabase.SaveAssets();
        }
        [MenuItem("Milyon Havuç/Tarlayı aç")]
        static void Open(){Initialize();EditorSceneManager.OpenScene("Assets/Scenes/Farm.unity");}
        [MenuItem("Milyon Havuç/Windows x64 derle")]
        public static void BuildWindows()
        {
            Initialize();Directory.CreateDirectory("Builds/Windows");var report=BuildPipeline.BuildPlayer(new[]{"Assets/Scenes/Farm.unity"},"Builds/Windows/MilyonHavuc.exe",BuildTarget.StandaloneWindows64,BuildOptions.None);
            if(report.summary.result!=UnityEditor.Build.Reporting.BuildResult.Succeeded)throw new System.Exception("Windows derlemesi başarısız: "+report.summary.result);
        }
    }
}
#endif
