# Ceol Formula Studio

PowerPoint向けのWindowsデスクトップ数式エディタです。

## [⬇ Windows版 v1.2.2 インストーラーをダウンロード](https://github.com/gtgtysys/math-editor/releases/download/v1.2.2/Ceol-Formula-Studio-Setup-1.2.2.exe)

Windows 10/11対応です。Node.js、ブラウザ、ローカルサーバーは必要ありません。

[更新内容・ソースコード・その他の配布ファイルを見る](https://github.com/gtgtysys/math-editor/releases/latest)

フォントとAPIキーは同梱していません。利用するフォントはPCへインストールしてください。
## 主な機能

- 分数、平方根、上下付き、総和、積分、行列などの数式
- Ceol ItalicとEuclid Symbol Regularを初期設定
- PC内フォントと文字ごとのフォント・位置・色指定
- 透過背景、PowerPoint標準色、SVG／EMF／PNG
- PowerPointから数式・文字位置・色・フォント設定を復元
- Gemini／OpenAIによる自然言語・画像からの数式変換

## 使い方

1. インストーラーをダウンロードして起動します。
2. 画面の案内に従ってインストールし、デスクトップまたはスタートメニューのアイコンから起動します。
3. 「画像をコピー」でPowerPointへ貼り付けます。
4. PowerPoint上の画像をコピーし、「PPTから貼り付け」で再編集します。

## 全体設定の初期値

本文はCeol Italic、関数名はCeol Regular、ギリシャ文字と数式記号はEuclid Symbol Regular、サイズは22 pt、文字色は白です。編集キャンバスは#003400、書き出す画像は透過、出力サイズは等倍、コピー形式はベクターです。

## API設定

EXEと同じ場所に次の構成で置きます。

```text
Ceol Formula Studio.exe
config/
  api-settings.json
```

`api-settings.json`の例:

```json
{
  "provider": "gemini",
  "model": "gemini-2.5-flash",
  "key": "APIキー"
}
```

APIキーを含む実ファイルはGitHubへ公開しないでください。

## ソースコード

[v1.2.2 ソースZIP](https://github.com/gtgtysys/math-editor/releases/download/v1.2.2/Ceol-Formula-Studio-1.2.2-source.zip)

フォントファイルは配布物とソースに含めていません。利用するPCへ必要なフォントを導入してください。
