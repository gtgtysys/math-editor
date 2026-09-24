using System;
using System.IO;
using System.Text;
using System.Text.RegularExpressions;
using System.Collections.Generic;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Drawing.Imaging;
using System.Runtime.InteropServices;
using System.Windows.Forms;
using System.Web.Script.Serialization;

public sealed class CeolShape { public string type,path,color; public float x,y,w,h,strokeWidth; }
public sealed class CeolCopy { public float width,height,offsetX,offsetY,scale,boldWidth; public bool transparent; public string background,project,svg,png; public CeolShape[] items; }
public static class CeolClipboard {
  [DllImport("user32.dll")] static extern bool OpenClipboard(IntPtr h);
  [DllImport("user32.dll")] static extern bool CloseClipboard();
  [DllImport("user32.dll")] static extern bool EmptyClipboard();
  [DllImport("user32.dll")] static extern IntPtr SetClipboardData(uint format,IntPtr h);
  [DllImport("user32.dll")] static extern IntPtr GetClipboardData(uint format);


  [DllImport("user32.dll",CharSet=CharSet.Unicode)] static extern uint RegisterClipboardFormat(string name);
  [DllImport("kernel32.dll")] static extern IntPtr GlobalAlloc(uint flags,UIntPtr size);
  [DllImport("kernel32.dll")] static extern IntPtr GlobalLock(IntPtr h);
  [DllImport("kernel32.dll")] static extern bool GlobalUnlock(IntPtr h);
  [DllImport("kernel32.dll")] static extern IntPtr GlobalFree(IntPtr h);
  [DllImport("kernel32.dll")] static extern UIntPtr GlobalSize(IntPtr h);
  [DllImport("gdi32.dll")] static extern IntPtr CopyEnhMetaFile(IntPtr h,string file);
  [DllImport("gdi32.dll")] static extern bool DeleteEnhMetaFile(IntPtr h);
  [DllImport("gdi32.dll")] static extern uint GetEnhMetaFileBits(IntPtr h,uint count,byte[] data);
  [DllImport("gdi32.dll")] static extern bool GdiComment(IntPtr h,uint size,byte[] data);
  static JavaScriptSerializer Json = new JavaScriptSerializer { MaxJsonLength=32000000 };
  static void Open(IntPtr h) { for(int i=0;i<20;i++){if(OpenClipboard(h))return;System.Threading.Thread.Sleep(25);}throw new Exception("クリップボードが使用中です。もう一度お試しください。"); }
  static void Put(uint format,byte[] bytes){IntPtr h=GlobalAlloc(0x42,(UIntPtr)bytes.Length);if(h==IntPtr.Zero)throw new Exception("メモリを確保できません。");IntPtr p=GlobalLock(h);Marshal.Copy(bytes,0,p,bytes.Length);GlobalUnlock(h);if(SetClipboardData(format,h)==IntPtr.Zero){GlobalFree(h);throw new Exception("クリップボードへ書き込めません。");}}
  static byte[] Get(uint format){IntPtr h=GetClipboardData(format);if(h==IntPtr.Zero)return null;ulong len=GlobalSize(h).ToUInt64();if(len>32000000||len==0)return null;IntPtr p=GlobalLock(h);if(p==IntPtr.Zero)return null;try{byte[] b=new byte[(int)len];Marshal.Copy(p,b,0,b.Length);return b;}finally{GlobalUnlock(h);}}
  static float Num(MatchCollection a,ref int i){if(i>=a.Count)throw new Exception("不正なパスです。");return float.Parse(a[i++].Value,System.Globalization.CultureInfo.InvariantCulture);}
  static GraphicsPath PathOf(string data){var a=Regex.Matches(data??"","[MLCQHVZ]|[-+]?(?:[0-9]*\\.)?[0-9]+(?:[eE][-+]?[0-9]+)?");var p=new GraphicsPath(FillMode.Winding);int i=0;float x=0,y=0,sx=0,sy=0;while(i<a.Count){string c=a[i++].Value;float nx,ny;switch(c){case "M":x=Num(a,ref i);y=Num(a,ref i);sx=x;sy=y;p.StartFigure();break;case "L":nx=Num(a,ref i);ny=Num(a,ref i);p.AddLine(x,y,nx,ny);x=nx;y=ny;break;case "H":nx=Num(a,ref i);p.AddLine(x,y,nx,y);x=nx;break;case "V":ny=Num(a,ref i);p.AddLine(x,y,x,ny);y=ny;break;case "C":float x1=Num(a,ref i),y1=Num(a,ref i),x2=Num(a,ref i),y2=Num(a,ref i);nx=Num(a,ref i);ny=Num(a,ref i);p.AddBezier(x,y,x1,y1,x2,y2,nx,ny);x=nx;y=ny;break;case "Q":float qx=Num(a,ref i),qy=Num(a,ref i);nx=Num(a,ref i);ny=Num(a,ref i);p.AddBezier(x,y,x+(qx-x)*2/3,y+(qy-y)*2/3,nx+(qx-nx)*2/3,ny+(qy-ny)*2/3,nx,ny);x=nx;y=ny;break;case "Z":p.CloseFigure();x=sx;y=sy;break;default:throw new Exception("未対応のパスです。");}}return p;}
  static string Copy(string payload){var c=Json.Deserialize<CeolCopy>(payload);using(var bitmap=new Bitmap(1,1))using(var reference=Graphics.FromImage(bitmap))using(var stream=new MemoryStream()){
    IntPtr hdc=reference.GetHdc();Metafile emf;try{emf=new Metafile(stream,hdc,new RectangleF(0,0,c.width*c.scale,c.height*c.scale),MetafileFrameUnit.Pixel,EmfType.EmfOnly);}finally{reference.ReleaseHdc(hdc);}
    using(emf){using(var g=Graphics.FromImage(emf)){
      var comment=Encoding.ASCII.GetBytes("CEOL_EMF_V1:"+Convert.ToBase64String(Encoding.UTF8.GetBytes(c.project))+":ENDCEOL");IntPtr dc=g.GetHdc();try{if(!GdiComment(dc,(uint)comment.Length,comment))throw new Exception("編集情報を記録できません。");}finally{g.ReleaseHdc(dc);}
      g.PageUnit=GraphicsUnit.Pixel;g.SmoothingMode=SmoothingMode.AntiAlias;
      if(!c.transparent)using(var b=new SolidBrush(ColorTranslator.FromHtml(c.background)))g.FillRectangle(b,0,0,c.width*c.scale,c.height*c.scale);
      using(var transform=new Matrix(c.scale,0,0,c.scale,c.offsetX*c.scale,c.offsetY*c.scale))g.Transform=transform;
      foreach(var item in c.items){Color color=ColorTranslator.FromHtml(item.color);if(item.type=="line"){using(var b=new SolidBrush(color))g.FillRectangle(b,item.x,item.y,item.w,item.h);continue;}
        using(var path=PathOf(item.path)){using(var shift=new Matrix(1,0,0,1,item.x,item.y))path.Transform(shift);
          if(item.type=="glyph"){using(var b=new SolidBrush(color))g.FillPath(b,path);if(c.boldWidth>0)using(var pen=new Pen(color,c.boldWidth)){pen.LineJoin=LineJoin.Round;g.DrawPath(pen,path);}}
          else using(var pen=new Pen(color,item.strokeWidth)){pen.LineJoin=LineJoin.Round;g.DrawPath(pen,path);}
        }
      }
    }
    IntPtr native=emf.GetHenhmetafile();try{using(var form=new Form()){Open(form.Handle);try{EmptyClipboard();IntPtr copied=CopyEnhMetaFile(native,null);if(copied==IntPtr.Zero)throw new Exception("ベクターを作成できません。");if(SetClipboardData(14,copied)==IntPtr.Zero){DeleteEnhMetaFile(copied);throw new Exception("ベクターをコピーできません。");}
      Put(RegisterClipboardFormat("Ceol Formula"),Encoding.UTF8.GetBytes(c.project));Put(RegisterClipboardFormat("image/svg+xml"),Encoding.UTF8.GetBytes(c.svg+"\0"));Put(RegisterClipboardFormat("PNG"),Convert.FromBase64String(c.png));
    }finally{CloseClipboard();}}}finally{DeleteEnhMetaFile(native);}
    }
  }return "{\"ok\":true,\"format\":\"EMF\"}";}
  static string Paste(){IntPtr emf=IntPtr.Zero;byte[] png=null;string svg=null;Open(IntPtr.Zero);try{
    var project=Get(RegisterClipboardFormat("Ceol Formula"));if(project!=null)return Json.Serialize(new{project=Encoding.UTF8.GetString(project).TrimEnd('\0')});
    var svgBytes=Get(RegisterClipboardFormat("image/svg+xml"));if(svgBytes!=null)svg=Encoding.UTF8.GetString(svgBytes).TrimEnd('\0');
    IntPtr original=GetClipboardData(14);if(original!=IntPtr.Zero){uint len=GetEnhMetaFileBits(original,0,null);if(len>0&&len<32000000){var bytes=new byte[len];GetEnhMetaFileBits(original,len,bytes);var match=Regex.Match(Encoding.ASCII.GetString(bytes),"CEOL_EMF_V1:([A-Za-z0-9+/=]+):ENDCEOL");if(match.Success)return Json.Serialize(new{project=Encoding.UTF8.GetString(Convert.FromBase64String(match.Groups[1].Value))});}emf=CopyEnhMetaFile(original,null);}
    png=Get(RegisterClipboardFormat("PNG"));
  }finally{CloseClipboard();}
  if(png!=null){if(emf!=IntPtr.Zero)DeleteEnhMetaFile(emf);return Json.Serialize(new{svg=svg,image="data:image/png;base64,"+Convert.ToBase64String(png)});}
  if(emf!=IntPtr.Zero){using(var image=new Metafile(emf,true)){int w=Math.Max(1,image.Width),h=Math.Max(1,image.Height);if((long)w*h>32000000)throw new Exception("貼り付ける画像が大きすぎます。");using(var b=new Bitmap(w,h))using(var g=Graphics.FromImage(b))using(var output=new MemoryStream()){g.Clear(Color.Transparent);g.DrawImage(image,0,0,w,h);b.Save(output,ImageFormat.Png);return Json.Serialize(new{svg=svg,image="data:image/png;base64,"+Convert.ToBase64String(output.ToArray())});}}}
  using(var image=Clipboard.GetImage()){if(image!=null){using(var output=new MemoryStream()){image.Save(output,ImageFormat.Png);return Json.Serialize(new{svg=svg,image="data:image/png;base64,"+Convert.ToBase64String(output.ToArray())});}}}
  if(svg!=null)return Json.Serialize(new{svg=svg});
  return "{\"error\":\"画像がありません。PPTで画像や図形を選択してコピーしてください。\"}";
  }
  public static string Run(string mode,string data){return mode=="copy"?Copy(data):Paste();}
}



