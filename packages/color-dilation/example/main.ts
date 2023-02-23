import { dilateColor } from "../src";
// 处理 arrayBuffer
const uploadBtn = <HTMLInputElement>document.getElementById("uploadFile");
const downloadBtn = <HTMLButtonElement>document.getElementById("downloadFile");

const alpha = <HTMLInputElement>document.getElementById("alpha");
const range = <HTMLInputElement>document.getElementById("range");
const textAlpha = <HTMLSpanElement>document.getElementById("alphaResult");
const textRange = <HTMLSpanElement>document.getElementById("rangeResult");

const originImg = <HTMLImageElement>document.getElementById("previewOrigin");
const processImg = <HTMLImageElement>document.getElementById("previewProcess");
const resultImg = <HTMLImageElement>document.getElementById("previewResult");

const canvas = document.createElement("canvas");
let alphaValue = 0,
  rangeVaule = 10;

uploadBtn.addEventListener("change", (evt: Event) => {
  const target = <HTMLInputElement>evt.target;
  const file: File = (<FileList>target.files)[0];
  processFile(file);
});

downloadBtn.addEventListener("click", () => {
  canvas.toBlob(async (blob) => {
    const a = document.createElement("a");
    document.body.appendChild(a);
    a.style.display = "none";
    a.target = "_blank";
    a.href = window.URL.createObjectURL(<Blob>blob);

    a.addEventListener("click", () => {
      if (a.parentElement) {
        a.parentElement.removeChild(a);
      }
    });

    a.click();
  }, "image/png");
});

alpha.addEventListener("change", () => {
  alphaValue = Number(alpha.value);
  textAlpha.innerText = alpha.value;
});

range.addEventListener("change", () => {
  rangeVaule = Number(range.value);
  textRange.innerText = range.value;
});

const uploadAsImg = function (file: Blob): Promise<FileReader> {
  return new Promise((resolve) => {
    let reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      resolve(reader);
    };
  });
};

const uploadAsArrayBuffer = function (file: Blob): Promise<FileReader> {
  return new Promise((resolve) => {
    let reader = new FileReader();
    reader.readAsArrayBuffer(file);
    reader.onload = () => {
      resolve(reader);
    };
  });
};

const processFile = async (file: Blob) => {
  const imgReader = await uploadAsImg(file);
  const arrayBufferReader = await uploadAsArrayBuffer(file);

  // preview origin picture
  originImg.src = <string>imgReader.result;

  // preview result picture
  const resultBolb = await dilateColor(
    <ArrayBuffer>arrayBufferReader.result,
    { range: rangeVaule, alpha: alphaValue },
    canvas
  );
  resultImg.src = URL.createObjectURL(<Blob>resultBolb);

  // preview picture in process
  const processBolb = await dilateColor(<ArrayBuffer>arrayBufferReader.result, { range: 10, alpha: 255 });
  processImg.src = URL.createObjectURL(<Blob>processBolb);
};
