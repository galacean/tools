const path = require("path");
const fs = require("fs");
import { walkDir } from "./FileHandler";
import { texturePacker2Oasis } from "./TransHandler";
export function formatConversion(filePath: string, cmdObj: any) {
  // 统一一下路径的斜杆
  filePath = filePath.replace(/\\/g, "/");
  // 不是绝对路径的话需要进行路径拼接
  if (!path.isAbsolute(filePath)) {
    // 当前操作的目录
    var rootDirPath = process.cwd().replace(/\\/g, "/");
    filePath = path.join(rootDirPath, filePath);
  }
  // 递归解析
  walkDir(
    filePath,
    (singlePath: string, fileData: Buffer) => {
      try {
        const resAtlas = texturePacker2Oasis([JSON.parse(fileData.toString())]);
        if (resAtlas) {
          const outPath = cmdObj.output
            ? cmdObj.output
            : path.basename(singlePath).split(".")[0] + "-oasis";
          fs.writeFileSync(
            path.join(path.dirname(singlePath), outPath + ".atlas"),
            JSON.stringify(resAtlas)
          );
        }
      } catch (error) {
        console.error("jsonParseErr【" + singlePath + "】");
      }
    },
    () => {
      
    }
  );
}
