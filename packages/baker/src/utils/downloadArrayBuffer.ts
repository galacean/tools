export function downloadArrayBuffer(ab: ArrayBuffer, name: string) {
  const link = document.createElement("a");
  link.style.display = "none";
  document.body.appendChild(link);

  const blob = new Blob([ab], { type: "text/plain" });
  const objectURL = URL.createObjectURL(blob);

  link.href = objectURL;
  link.href = URL.createObjectURL(blob);
  link.download = `${name}.env`;
  link.click();

  URL.revokeObjectURL(link.href);
  document.body.removeChild(link);
}
